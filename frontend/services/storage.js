import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'fixmystreet_auth_token';
const USER_KEY = 'fixmystreet_user_data';

// Fallback in-memory cache for web or environments where SecureStore is unavailable
let memoryStorage = {};

export const tokenStorage = {
  async getToken() {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(TOKEN_KEY) || memoryStorage[TOKEN_KEY] || null;
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (e) {
      console.warn('SecureStore getToken failed, reading memory storage', e);
      return memoryStorage[TOKEN_KEY] || null;
    }
  },

  async setToken(token) {
    try {
      memoryStorage[TOKEN_KEY] = token;
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (e) {
      console.warn('SecureStore setToken error:', e);
    }
  },

  async removeToken() {
    try {
      delete memoryStorage[TOKEN_KEY];
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch (e) {
      console.warn('SecureStore removeToken error:', e);
    }
  },

  async getUser() {
    try {
      let raw;
      if (Platform.OS === 'web') {
        raw = localStorage.getItem(USER_KEY) || memoryStorage[USER_KEY];
      } else {
        raw = await SecureStore.getItemAsync(USER_KEY);
      }
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('SecureStore getUser error:', e);
      return memoryStorage[USER_KEY] ? JSON.parse(memoryStorage[USER_KEY]) : null;
    }
  },

  async setUser(user) {
    try {
      const serialized = JSON.stringify(user);
      memoryStorage[USER_KEY] = serialized;
      if (Platform.OS === 'web') {
        localStorage.setItem(USER_KEY, serialized);
      } else {
        await SecureStore.setItemAsync(USER_KEY, serialized);
      }
    } catch (e) {
      console.warn('SecureStore setUser error:', e);
    }
  },

  async removeUser() {
    try {
      delete memoryStorage[USER_KEY];
      if (Platform.OS === 'web') {
        localStorage.removeItem(USER_KEY);
      } else {
        await SecureStore.deleteItemAsync(USER_KEY);
      }
    } catch (e) {
      console.warn('SecureStore removeUser error:', e);
    }
  },

  async clearAll() {
    await this.removeToken();
    await this.removeUser();
    memoryStorage = {};
  },
};
