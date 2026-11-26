import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { notificationService } from './api';

// Configure how foreground notifications behave on SDK 58
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export const isExpoGoClient = () => {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient'
  );
};

export const getExpoProjectId = () => {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    null
  );
};

/**
 * Configure Android channel, request optional notification permissions,
 * and register Expo push token on supported Android/iOS builds.
 * Never throws so denied permissions or Expo Go mode do not disrupt the app.
 */
export const registerForPushNotificationsAsync = async () => {
  if (Platform.OS === 'web') {
    return { token: null, permission: 'unsupported', isExpoGo: false };
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FixMyStreet Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0d9488',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { token: null, permission: 'denied', isExpoGo: isExpoGoClient() };
    }

    // Remote Android push tokens require a development build or EAS APK (not Expo Go)
    if (isExpoGoClient()) {
      return {
        token: null,
        permission: 'granted',
        isExpoGo: true,
      };
    }

    if (!Device.isDevice) {
      return {
        token: null,
        permission: 'granted',
        isExpoGo: false,
        reason: 'Physical device required for push tokens',
      };
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      return {
        token: null,
        permission: 'granted',
        isExpoGo: false,
        reason: 'Missing EAS projectId in app configuration',
      };
    }

    const pushTokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = pushTokenResponse?.data || null;

    if (token) {
      await notificationService.registerPushToken(token);
    }

    return {
      token,
      permission: 'granted',
      isExpoGo: false,
    };
  } catch (error) {
    console.warn('Push notification registration skipped safely:', error.message);
    return {
      token: null,
      permission: 'error',
      isExpoGo: isExpoGoClient(),
      error: error.message,
    };
  }
};
