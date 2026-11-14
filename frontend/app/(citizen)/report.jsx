import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
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
  const [imageUri, setImageUri] = useState(null);
  const [location, setLocation] = useState({
    latitude: 23.0225,
    longitude: 72.5714,
    address: '',
  });

  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Photo Selection: Camera or Gallery
  const pickImage = async (useCamera = false) => {
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
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
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
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setErrorMessage('');
      }
    } catch (e) {
      console.warn('Image picker error:', e);
      Alert.alert('Error', 'Unable to pick photo. Please try again.');
    }
  };

  // 2. Fetch Current GPS Location
  const getCurrentLocation = async () => {
    try {
      setGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Denied',
          'GPS location helps city workers locate the issue accurately. You can still type the address manually.'
        );
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = currentLocation.coords;

      // Reverse geocode to street address
      let formattedAddress = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (addresses && addresses.length > 0) {
          const item = addresses[0];
          formattedAddress = [
            item.name,
            item.street,
            item.district || item.subregion,
            item.city,
            item.postalCode,
          ]
            .filter(Boolean)
            .join(', ');
        }
      } catch (geocodeErr) {
        console.warn('Geocoding error:', geocodeErr);
      }

      setLocation({
        latitude,
        longitude,
        address: formattedAddress,
      });
    } catch (e) {
      console.warn('Location error:', e);
      Alert.alert(
        'GPS Signal Unavailable',
        'Could not obtain precise GPS coordinates. Please enter location manually.'
      );
    } finally {
      setGettingLocation(false);
    }
  };

  // 3. Submit Complaint Form
  const handleSubmit = async () => {
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Please provide a title for the issue');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Please describe the problem in detail');
      return;
    }

    if (!imageUri) {
      setErrorMessage('Please take or select a photo of the problem');
      return;
    }

    try {
      setSubmitting(true);

      // Step A: Upload image to Cloudinary / backend storage
      const uploadRes = await uploadService.uploadImage(imageUri);
      const uploadedImageUrl = uploadRes?.data?.url;
      const uploadedPublicId = uploadRes?.data?.public_id || '';

      if (!uploadedImageUrl) {
        throw new Error('Image upload failed to return a valid URL.');
      }

      // Step B: Submit Complaint payload to MongoDB
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        imageUrl: uploadedImageUrl,
        imagePublicId: uploadedPublicId,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || 'Reported via GPS',
      };

      const issueRes = await issueService.create(payload);

      Alert.alert(
        'Complaint Submitted!',
        'Your civic complaint has been registered in the system. Authorized administrators will inspect and update the status.',
        [
          {
            text: 'View All Issues',
            onPress: () => router.push('/(citizen)/issues'),
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Report a Street Issue" subtitle="File a civic complaint" />
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
        {imageUri ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <TouchableOpacity
              style={styles.changePhotoBtn}
              onPress={() => setImageUri(null)}
            >
              <Ionicons name="trash-outline" size={16} color="#ffffff" />
              <Text style={styles.changePhotoText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoPickerBox}>
            <Text style={styles.photoPickerPrompt}>
              Upload a clear photo of the street problem
            </Text>
            <View style={styles.photoBtnRow}>
              <TouchableOpacity
                style={styles.photoOptionBtn}
                onPress={() => pickImage(true)}
              >
                <Ionicons name="camera" size={24} color={COLORS.primary} />
                <Text style={styles.photoOptionText}>Take Camera Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoOptionBtn}
                onPress={() => pickImage(false)}
              >
                <Ionicons name="images" size={24} color={COLORS.primary} />
                <Text style={styles.photoOptionText}>Choose from Gallery</Text>
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
          onChangeText={setTitle}
        />

        {/* Description Input */}
        <Input
          label="Description"
          placeholder="Describe how severe the problem is, nearby landmarks, etc."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        {/* GPS Location Section */}
        <View style={styles.locationSection}>
          <View style={styles.locationHeaderRow}>
            <Text style={styles.fieldLabel}>GPS Coordinates & Location</Text>
            <TouchableOpacity
              onPress={getCurrentLocation}
              disabled={gettingLocation}
              style={styles.gpsFetchBtn}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="locate" size={16} color={COLORS.primary} />
                  <Text style={styles.gpsFetchText}>Fetch My GPS</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.coordsCard}>
            <Text style={styles.coordsText}>
              Lat: {location.latitude.toFixed(6)} | Long:{' '}
              {location.longitude.toFixed(6)}
            </Text>
          </View>

          <Input
            label="Street Address / Landmark"
            placeholder="e.g. Near City Bank, Ring Road"
            value={location.address}
            onChangeText={(text) =>
              setLocation((prev) => ({ ...prev, address: text }))
            }
            icon="location-outline"
          />
        </View>

        {/* Submit Button */}
        <Button
          title={submitting ? 'Uploading & Registering...' : 'Submit Complaint'}
          onPress={handleSubmit}
          loading={submitting}
          icon="send"
          style={styles.submitBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerBg,
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
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  photoPickerPrompt: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  photoBtnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  photoOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
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
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  gpsFetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
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
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  submitBtn: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xxl,
  },
});
