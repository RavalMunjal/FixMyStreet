import * as Location from 'expo-location';

// Check that latitude and longitude are valid real numbers within GPS bounds
export const isValidCoordinate = (latitude, longitude) => {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
};

// Convert coordinates into a readable street address (falls back to lat, lng)
export const formatAddressFromCoords = async (latitude, longitude) => {
  const fallback = `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
  if (!isValidCoordinate(latitude, longitude)) return fallback;

  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!results || results.length === 0) return fallback;

    const place = results[0];
    const parts = [
      place.name,
      place.street,
      place.district || place.subregion,
      place.city || place.region,
    ].filter(Boolean);

    // Remove duplicate adjacent parts such as matching name and street
    const uniqueParts = [...new Set(parts)];
    return uniqueParts.length > 0 ? uniqueParts.join(', ') : fallback;
  } catch (err) {
    console.warn('Reverse geocoding failed:', err.message);
    return fallback;
  }
};

// Ask for foreground GPS permission and read the user's current coordinates
export const getCurrentGpsPosition = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { granted: false, coords: null, message: 'Location permission denied.' };
    }

    let position = null;
    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch {
      position = await Location.getLastKnownPositionAsync();
    }

    const lat = position?.coords?.latitude;
    const lng = position?.coords?.longitude;
    if (!isValidCoordinate(lat, lng)) {
      return {
        granted: true,
        coords: null,
        message: 'Could not read GPS signal. Try selecting a point on the map.',
      };
    }

    return {
      granted: true,
      coords: { latitude: lat, longitude: lng },
      message: '',
    };
  } catch (err) {
    return {
      granted: false,
      coords: null,
      message: err.message || 'Unable to access device GPS.',
    };
  }
};
