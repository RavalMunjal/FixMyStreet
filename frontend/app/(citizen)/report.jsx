import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { CATEGORIES } from '../../constants/categories';
import { uploadService, issueService } from '../../services/api';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';

export default function ReportIssueScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [description, setDescription] = useState('');
  const [imageAsset, setImageAsset] = useState(null);
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    address: '',
  });
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState('');

  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Fetch Current GPS Location
  const getCurrentLocation = useCallback(async (silent = false) => {
    try {
      setGettingLocation(true);
      setGpsStatusMessage('Fetching your current GPS coordinates...');

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatusMessage(
          'Location permission denied. Enable GPS or enter coordinates manually below.'
        );
        setShowManualCoords(true);
        if (!silent) {
          Alert.alert(
            'Location Permission Denied',
            'GPS location helps city workers locate the issue accurately. You can allow permission in Settings or enter coordinates manually.'
          );
        }
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = currentLocation.coords;

      let formattedAddress = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (addresses && addresses.length > 0) {
          const item = addresses[0];
          const parts = [
            item.name,
            item.street,
            item.district || item.subregion,
            item.city,
            item.postalCode,
          ].filter(Boolean);
          if (parts.length > 0) {
            formattedAddress = parts.join(', ');
          }
        }
      } catch (geocodeErr) {
        console.warn('Reverse geocoding error:', geocodeErr);
      }

      setLocation((prev) => ({
        latitude,
        longitude,
        address: prev.address ? prev.address : formattedAddress,
      }));
      setManualLat(latitude.toFixed(6));
      setManualLng(longitude.toFixed(6));
      setGpsStatusMessage('');
      setShowManualCoords(false);
    } catch (e) {
      console.warn('Location error:', e);
      setGpsStatusMessage(
        'Unable to obtain GPS fix. Tap Retry GPS or enter coordinates manually.'
      );
      setShowManualCoords(true);
      if (!silent) {
        Alert.alert(
          'GPS Signal Unavailable',
          'Could not obtain precise GPS coordinates. Please ensure GPS/Location is turned on or enter coordinates manually.'
        );
      }
    } finally {
      setGettingLocation(false);
    }
  }, []);

  useEffect(() => {
    getCurrentLocation(true);
  }, [getCurrentLocation]);

  // 2. Photo Selection: Camera or Gallery
  const pickImage = async (useCamera = false) => {
    if (submitting) return;
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Denied',
            'FixMyStreet needs camera access to take photos of street issues.'
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.65,
        });
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Gallery Permission Denied',
            'FixMyStreet needs photo library access to upload photos.'
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.65,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selected = result.assets[0];
        if (selected.fileSize && selected.fileSize > 5 * 1024 * 1024) {
          Alert.alert(
            'Photo Too Large',
            'Please choose an image smaller than 5MB.'
          );
          return;
        }
        setImageAsset(selected);
        setErrorMessage('');
      }
    } catch (e) {
      console.warn('Image picker error:', e);
      Alert.alert('Error', 'Unable to pick photo. Please try again.');
    }
  };

  // Resolve active coordinates (GPS or validated manual override)
  const getResolvedCoordinates = () => {
    if (showManualCoords && manualLat.trim() !== '' && manualLng.trim() !== '') {
      const lat = Number(manualLat.trim());
      const lng = Number(manualLng.trim());
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        return { latitude: lat, longitude: lng };
      }
      return null;
    }

    if (
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number' &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude)
    ) {
      return { latitude: location.latitude, longitude: location.longitude };
    }

    return null;
  };

  const resetForm = () => {
    setTitle('');
    setCategory(CATEGORIES[0].id);
    setDescription('');
    setImageAsset(null);
    setErrorMessage('');
    setLocation((prev) => ({
      ...prev,
      address: '',
    }));
  };

  // 3. Submit Complaint Form
  const handleSubmit = async () => {
    if (submitting) return;
    setErrorMessage('');

    if (!imageAsset?.uri) {
      setErrorMessage('Please take or select a photo of the problem.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please provide a title for the issue.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Please describe the problem in detail.');
      return;
    }

    const coords = getResolvedCoordinates();
    if (!coords) {
      setErrorMessage(
        'Valid GPS coordinates are required. Tap "Fetch My GPS" or enter valid latitude (-90..90) and longitude (-180..180).'
      );
      setShowManualCoords(true);
      return;
    }

    try {
      setSubmitting(true);

      // Step A: Upload image to backend / Cloudinary
      const uploadRes = await uploadService.uploadImage(imageAsset);
      const uploadedImageUrl = uploadRes?.data?.url;
      const uploadedPublicId = uploadRes?.data?.public_id || '';

      if (!uploadedImageUrl) {
        throw new Error('Image upload failed to return a valid URL.');
      }

      // Step B: Save Complaint to MongoDB
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        imageUrl: uploadedImageUrl,
        imagePublicId: uploadedPublicId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address:
          location.address.trim() ||
          `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
      };

      const issueRes = await issueService.create(payload);
      if (!issueRes?.success || !issueRes?.data?.issue?._id) {
        throw new Error(
          issueRes?.message || 'Complaint could not be confirmed in database.'
        );
      }

      resetForm();

      Alert.alert(
        'Complaint Submitted!',
        'Your civic complaint has been saved in MongoDB. Administrators can now review and update its status.',
        [
          {
            text: 'My Reports',
            onPress: () => router.replace('/(citizen)/my-complaints'),
          },
          {
            text: 'All Issues',
            onPress: () => router.replace('/(citizen)/issues'),
          },
        ]
      );
    } catch (error) {
      console.error('Submit issue error:', error);
      setErrorMessage(
        error.message || 'Failed to submit complaint. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hasValidGps =
    typeof location.latitude === 'number' && typeof location.longitude === 'number';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header title="Report a Street Issue" subtitle="File a civic complaint" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Photo Upload Area */}
          <Text style={styles.fieldLabel}>Photo Evidence (Required)</Text>
          {imageAsset?.uri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageAsset.uri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.changePhotoBtn}
                disabled={submitting}
                onPress={() => setImageAsset(null)}
              >
                <Ionicons name="trash-outline" size={16} color="#ffffff" />
                <Text style={styles.changePhotoText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoPickerBox}>
              <Text style={styles.photoPickerPrompt}>
                Upload a clear photo of the street problem (max 5MB)
              </Text>
              <View style={styles.photoBtnRow}>
                <TouchableOpacity
                  style={styles.photoOptionBtn}
                  disabled={submitting}
                  onPress={() => pickImage(true)}
                >
                  <Ionicons name="camera" size={20} color={COLORS.primary} />
                  <Text style={styles.photoOptionText}>Camera Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.photoOptionBtn}
                  disabled={submitting}
                  onPress={() => pickImage(false)}
                >
                  <Ionicons name="images" size={20} color={COLORS.primary} />
                  <Text style={styles.photoOptionText}>Choose Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Category Selector */}
          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  disabled={submitting}
                  onPress={() => setCategory(cat.id)}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected,
                  ]}
                >
                  <Ionicons
                    name={cat.icon}
                    size={16}
                    color={isSelected ? '#ffffff' : COLORS.text}
                    style={styles.catChipIcon}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Title Input */}
          <Input
            label="Issue Title"
            placeholder="e.g. Deep pothole causing bike accidents"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (errorMessage) setErrorMessage('');
            }}
            editable={!submitting}
          />

          {/* Description Input */}
          <Input
            label="Description"
            placeholder="Describe how severe the problem is, nearby landmarks, etc."
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (errorMessage) setErrorMessage('');
            }}
            multiline
            numberOfLines={4}
            editable={!submitting}
          />

          {/* GPS Location Section */}
          <View style={styles.locationSection}>
            <View style={styles.locationHeaderRow}>
              <Text style={styles.fieldLabel}>GPS Coordinates & Location</Text>
              <View style={styles.gpsActionRow}>
                <TouchableOpacity
                  onPress={() => getCurrentLocation(false)}
                  disabled={gettingLocation || submitting}
                  style={styles.gpsFetchBtn}
                >
                  {gettingLocation ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="locate" size={16} color={COLORS.primary} />
                      <Text style={styles.gpsFetchText}>
                        {hasValidGps ? 'Refresh GPS' : 'Fetch My GPS'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.coordsCard}>
              {hasValidGps ? (
                <Text style={styles.coordsText}>
                  Lat: {location.latitude.toFixed(6)} | Long:{' '}
                  {location.longitude.toFixed(6)}
                </Text>
              ) : (
                <Text style={styles.coordsWarningText}>
                  {gpsStatusMessage || 'Waiting for real GPS coordinates...'}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => setShowManualCoords((v) => !v)}
                style={styles.manualToggleBtn}
              >
                <Text style={styles.manualToggleText}>
                  {showManualCoords
                    ? 'Hide Manual Coordinates'
                    : 'Enter Coordinates Manually'}
                </Text>
              </TouchableOpacity>
            </View>

            {showManualCoords ? (
              <View style={styles.manualCoordsRow}>
                <View style={styles.manualCoordCol}>
                  <Input
                    label="Latitude"
                    placeholder="e.g. 23.0225"
                    value={manualLat}
                    onChangeText={setManualLat}
                    keyboardType="numbers-and-punctuation"
                    editable={!submitting}
                  />
                </View>
                <View style={styles.manualCoordCol}>
                  <Input
                    label="Longitude"
                    placeholder="e.g. 72.5714"
                    value={manualLng}
                    onChangeText={setManualLng}
                    keyboardType="numbers-and-punctuation"
                    editable={!submitting}
                  />
                </View>
              </View>
            ) : null}

            <Input
              label="Street Address / Landmark"
              placeholder="e.g. Near City Bank, Ring Road"
              value={location.address}
              onChangeText={(text) =>
                setLocation((prev) => ({ ...prev, address: text }))
              }
              icon="location-outline"
              editable={!submitting}
            />
          </View>

          {/* Submit Button */}
          <Button
            title={submitting ? 'Uploading & Saving...' : 'Submit Complaint'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            icon="send"
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.sm,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  fieldLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  photoPickerBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.borderDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  photoPickerPrompt: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  photoBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  photoOptionBtn: {
    flex: 1,
    minWidth: 130,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  photoOptionText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceAlt,
  },
  changePhotoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  changePhotoText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    marginLeft: 4,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catChipIcon: {
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  categoryChipTextSelected: {
    color: '#ffffff',
  },
  locationSection: {
    marginTop: SPACING.sm,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  gpsActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsFetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
  },
  gpsFetchText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
    marginLeft: 4,
  },
  coordsCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  coordsText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  coordsWarningText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.pending,
    fontWeight: '600',
  },
  manualToggleBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  manualToggleText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  manualCoordsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  manualCoordCol: {
    flex: 1,
  },
  submitBtn: {
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
});
