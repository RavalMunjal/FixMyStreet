import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * FixMyStreet API Configuration
 *
 * Priority:
 * 1. Explicit EXPO_PUBLIC_API_URL environment variable (recommended for standalone APK / staging)
 * 2. Auto-detected Metro LAN hostUri IP in development (Expo Go on physical device)
 * 3. Android emulator loopback (10.0.2.2) / localhost fallback
 * 4. PRODUCTION_API_URL for release builds when EXPO_PUBLIC_API_URL is not set
 */

export const PRODUCTION_API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://fixmystreet-backend.onrender.com/api';

const getDevApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // When running via Expo Go, hostUri contains the PC's LAN IP (e.g. 10.170.124.221:8081)
  const rawHost =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    '';

  if (rawHost) {
    const cleaned = rawHost.replace(/^[a-z]+:\/\//i, '');
    const ip = cleaned.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000/api`;
    }
  }

  // Android emulator loopback vs iOS/web localhost
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api'
    : 'http://localhost:5000/api';
};

export const API_BASE_URL = __DEV__ ? getDevApiUrl() : PRODUCTION_API_URL;

export const APP_CONFIG = {
  appName: 'FixMyStreet',
  version: '1.0.0',
  maxImageSizeMB: 5,
  defaultLocation: {
    latitude: 23.0225,
    longitude: 72.5714,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  },
};
