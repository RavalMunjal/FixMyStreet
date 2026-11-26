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
import MapPinPickerModal from '../../components/MapPinPickerModal';
import { CATEGORIES, URGENCY_LEVELS } from '../../constants/categories';
import { uploadService, issueService } from '../../services/api';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';

export default function ReportIssueScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [requestedUrgency, setRequestedUrgency] = useState('Normal');
  const [description, setDescription] = useState('');
  const [imageAsset, setImageAsset] = useState(null);
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    address: '',
  });
  const [isManualPin, setIsManualPin] = useState(false);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);

  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState('');

  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const getCurrentLocation = useCallback(async (silent = false, force = false) => {
    // Do not overwrite user's confirmed manual map pin on silent background fetches
    if (isManualPin && !force) return;

    try {
      setGettingLocation(true);
      setGpsStatusMessage('Fetching your current GPS coordinates...');

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatusMessage(
          'Location permission denied. Tap "Pick on Map" or enter coordinates manually.'
        );
        if (!silent) {
          Alert.alert(
            'Location Permission Denied',
            'You can allow GPS permission in Settings, pick a pin on the map, or enter coordinates manually.'
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

      setLocation({
        latitude,
        longitude,
        address: formattedAddress,
      });
      setIsManualPin(false);
      setManualLat(latitude.toFixed(6));
      setManualLng(longitude.toFixed(6));
      setGpsStatusMessage('');
      setShowManualCoords(false);
    } catch (e) {
      console.warn('Location error:', e);
      setGpsStatusMessage(
        'GPS unavailable. Tap "Pick on Map" or enter coordinates manually.'
      );
      if (!silent) {
        Alert.alert(
          'GPS Signal Unavailable',
          'Could not obtain precise GPS coordinates. Please pick the location on the map or enter coordinates manually.'
        );
      }
    } finally {
      setGettingLocation(false);
    }
  }, [isManualPin]);

  useEffect(() => {
    getCurrentLocation(true, false);
  }, []);

  const handleConfirmMapPin = ({ latitude, longitude, address }) => {
    setLocation({
      latitude,
      longitude,
      address: address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    });
    setManualLat(latitude.toFixed(6));
    setManualLng(longitude.toFixed(6));
    setIsManualPin(true);
    setShowManualCoords(false);
    setGpsStatusMessage('');
    setMapPickerVisible(false);
    setErrorMessage('');
  };

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
          quality: 0.55,
          base64: true,
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
          quality: 0.55,
          base64: true,
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
    setRequestedUrgency('Normal');
    setDescription('');
    setImageAsset(null);
    setIsManualPin(false);
    setErrorMessage('');
    setLocation((prev) => ({
      ...prev,
      address: '',
    }));
  };

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
        'Valid location coordinates are required. Use GPS, pick a pin on the map, or enter valid coordinates.'
      );
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
        requestedUrgency,
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
        'Your civic complaint has been saved in MongoDB. You can track its progress timeline under My List or All Issues.',
        [
          {
            text: 'My List',
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
          <Text style={styles.fieldLabel}>1. Photo Evidence (Required)</Text>
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
          <Text style={styles.fieldLabel}>2. Issue Category</Text>
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

          {/* Feature 4: Report Urgency Selector */}
          <Text style={styles.fieldLabel}>3. Urgency Level</Text>
          <View style={styles.urgencyRow}>
            {URGENCY_LEVELS.map((u) => {
              const isSelected = requestedUrgency === u.id;
              const isHigh = u.id === 'High';
              return (
                <TouchableOpacity
                  key={u.id}
                  disabled={submitting}
                  onPress={() => setRequestedUrgency(u.id)}
                  style={[
                    styles.urgencyCard,
                    isSelected &&
                      (isHigh ? styles.urgencyCardHigh : styles.urgencyCardNormal),
                  ]}
                >
                  <View style={styles.urgencyHeaderRow}>
                    <Ionicons
                      name={isHigh ? 'alert-circle' : 'time-outline'}
                      size={18}
                      color={
                        isSelected
                          ? isHigh
                            ? COLORS.danger
                            : COLORS.primary
                          : COLORS.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.urgencyTitle,
                        isSelected &&
                          (isHigh
                            ? { color: COLORS.danger }
                            : { color: COLORS.primary }),
                      ]}
                    >
                      {u.label}
                    </Text>
                  </View>
                  <Text style={styles.urgencyDesc}>{u.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.emergencyDisclaimer}>
            Note: High urgency flags are verified by municipal admins and are not a substitute for emergency 112/911 services.
          </Text>

          {/* Title & Description */}
          <Input
            label="4. Issue Title"
            placeholder="e.g. Deep pothole causing bike accidents"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (errorMessage) setErrorMessage('');
            }}
            editable={!submitting}
          />

          <Input
            label="5. Description"
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

          {/* Feature 5: GPS & Manual Map Pin Location Section */}
          <View style={styles.locationSection}>
            <Text style={styles.fieldLabel}>6. Complaint Location</Text>

            <View style={styles.locationBtnRow}>
              <TouchableOpacity
                onPress={() => getCurrentLocation(false, true)}
                disabled={gettingLocation || submitting}
                style={styles.locationActionBtn}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="locate" size={16} color={COLORS.primary} />
                    <Text style={styles.locationActionText}>
                      Use Current GPS
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMapPickerVisible(true)}
                disabled={submitting}
                style={[styles.locationActionBtn, styles.mapPickerBtn]}
              >
                <Ionicons name="pin" size={16} color={COLORS.secondary} />
                <Text style={[styles.locationActionText, { color: COLORS.secondary }]}>
                  Pick on Map
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.coordsCard}>
              {hasValidGps ? (
                <View style={styles.coordsStatusRow}>
                  <Ionicons
                    name={isManualPin ? 'pin' : 'navigate-circle'}
                    size={16}
                    color={isManualPin ? COLORS.secondary : COLORS.primary}
                  />
                  <Text style={styles.coordsText}>
                    {isManualPin ? 'Manual Pin: ' : 'GPS Fix: '}
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.coordsWarningText}>
                  {gpsStatusMessage || 'Waiting for location coordinates...'}
                </Text>
              )}

              <TouchableOpacity
                onPress={() => setShowManualCoords((v) => !v)}
                style={styles.manualToggleBtn}
              >
                <Text style={styles.manualToggleText}>
                  {showManualCoords
                    ? 'Hide Manual Lat/Lng Inputs'
                    : 'Type Lat/Lng Manually'}
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
                    onChangeText={(val) => {
                      setManualLat(val);
                      setIsManualPin(true);
                    }}
                    keyboardType="numbers-and-punctuation"
                    editable={!submitting}
                  />
                </View>
                <View style={styles.manualCoordCol}>
                  <Input
                    label="Longitude"
                    placeholder="e.g. 72.5714"
                    value={manualLng}
                    onChangeText={(val) => {
                      setManualLng(val);
                      setIsManualPin(true);
                    }}
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

      {/* Fullscreen Map Pin Selection Modal */}
      <MapPinPickerModal
        visible={mapPickerVisible}
        initialCoords={location}
        onClose={() => setMapPickerVisible(false)}
        onConfirm={handleConfirmMapPin}
      />
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
    paddingBottom: SPACING.xl,
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
    paddingVertical: SPACING.sm + 2,
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
  urgencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  urgencyCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.sm + 2,
  },
  urgencyCardNormal: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fdfa',
  },
  urgencyCardHigh: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerBg,
  },
  urgencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  urgencyTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  urgencyDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  emergencyDisclaimer: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  locationSection: {
    marginTop: SPACING.xs,
  },
  locationBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  locationActionBtn: {
    flex: 1,
    minWidth: 135,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
  },
  mapPickerBtn: {
    backgroundColor: COLORS.secondaryLight,
  },
  locationActionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
    marginLeft: 6,
  },
  coordsCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  coordsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coordsText: {
    flex: 1,
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
    marginBottom: SPACING.md,
  },
});
