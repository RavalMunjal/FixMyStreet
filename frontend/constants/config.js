import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * FixMyStreet API Configuration
 * 
 * - Auto-detects your computer's local IP address when scanning with Expo Go on physical phone
 * - Uses http://10.0.2.2:5000/api for Android Emulator
 * - Uses PRODUCTION_API_URL for production APK builds
 */

export const PRODUCTION_API_URL = 'https://fixmystreet-backend.onrender.com/api';

const getDevApiUrl = () => {
  // When running via Expo Go, hostUri contains the PC's LAN IP (e.g. 192.168.x.x:8081)
  const hostUri =
    Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost || '';

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000/api`;
    }
  }

  // Android emulator loopback
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api'
    : 'http://localhost:5000/api';
};

export const API_BASE_URL = __DEV__ ? getDevApiUrl() : PRODUCTION_API_URL;

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
