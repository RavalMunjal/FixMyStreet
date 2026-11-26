import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'fixmystreet_auth_token';
const USER_KEY = 'fixmystreet_user_data';

// Fallback in-memory storage when SecureStore or web localStorage fails
let memoryStorage = {};

const getItem = async (key) => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key) || memoryStorage[key] || null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.warn(`Storage read error (${key}):`, err);
    return memoryStorage[key] || null;
  }
};

const setItem = async (key, value) => {
  try {
    memoryStorage[key] = value;
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (err) {
    console.warn(`Storage save error (${key}):`, err);
  }
};

const removeItem = async (key) => {
  try {
    delete memoryStorage[key];
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (err) {
    console.warn(`Storage delete error (${key}):`, err);
  }
};

export const tokenStorage = {
  getToken: () => getItem(TOKEN_KEY),
  setToken: (token) => setItem(TOKEN_KEY, token),
  removeToken: () => removeItem(TOKEN_KEY),

  async getUser() {
    try {
      const raw = await getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('Failed to parse cached user:', err);
      return null;
    }
  },

  setUser: (user) => setItem(USER_KEY, JSON.stringify(user)),
  removeUser: () => removeItem(USER_KEY),

  async clearAll() {
    await removeItem(TOKEN_KEY);
    await removeItem(USER_KEY);
    memoryStorage = {};
  },
};
