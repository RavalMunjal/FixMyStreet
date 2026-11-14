import { Platform } from 'react-native';

/**
 * FixMyStreet API Configuration
 * 
 * - Production / Deployed backend: Use your live Render or Railway URL
 * - Android Emulator: 'http://10.0.2.2:5000/api'
 * - Real Device / Expo Go: Replace with your PC local LAN IP e.g. 'http://192.168.1.100:5000/api'
 */

// CHANGE THIS TO YOUR HOSTED BACKEND URL (E.G. RENDER) FOR THE STANDALONE APK:
export const PRODUCTION_API_URL = 'https://fixmystreet-backend.onrender.com/api';

// Local development fallback:
export const LOCAL_DEV_API_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api'
    : 'http://localhost:5000/api';

// By default we check if __DEV__ is true, otherwise use production API URL
export const API_BASE_URL = __DEV__
  ? LOCAL_DEV_API_URL
  : PRODUCTION_API_URL;

export const APP_CONFIG = {
  appName: 'FixMyStreet',
  version: '1.0.0',
  submissionDeadline: '2026-11-22',
  maxImageSizeMB: 5,
  defaultLocation: {
    latitude: 23.0225, // Default Ahmedabad/central coordinates
    longitude: 72.5714,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  },
};
