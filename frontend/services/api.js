import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { tokenStorage } from './storage';

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

// Create base Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: inject Bearer token automatically
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await tokenStorage.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to retrieve token for API request', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: centralized error extraction & 401 session cleanup
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred. Please try again.';

    if (error.response) {
      if (error.response.data && error.response.data.message) {
        message = error.response.data.message;
      } else if (error.response.status === 401) {
        message = 'Session expired or unauthorized. Please log in.';
      } else if (error.response.status === 403) {
        message = 'Access forbidden: You do not have permission for this action.';
      } else if (error.response.status === 404) {
        message = 'Requested resource not found.';
      } else if (error.response.status >= 500) {
        message = 'Server error. Please try again later.';
      }

      // Trigger automatic logout on expired/invalid JWT for authenticated routes
      const reqUrl = error.config?.url || '';
      const isAuthEndpoint =
        reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register');
      if (error.response.status === 401 && !isAuthEndpoint && unauthorizedHandler) {
        unauthorizedHandler();
      }
    } else if (error.code === 'ECONNABORTED') {
      message = `Request timed out connecting to ${API_BASE_URL}. Please check your server.`;
    } else if (error.request) {
      message = `Cannot connect to FixMyStreet server (${API_BASE_URL}). Verify PC & phone are on the same Wi-Fi and backend is running.`;
    }

    const enhancedError = new Error(message);
    enhancedError.status = error.response?.status;
    enhancedError.data = error.response?.data;
    return Promise.reject(enhancedError);
  }
);

// ================= AUTH SERVICE =================
export const authService = {
  async register(name, email, password, confirmPassword) {
    const res = await api.post('/auth/register', {
      name,
      email,
      password,
      confirmPassword,
    });
    return res.data;
  },

  async login(email, password) {
    const res = await api.post('/auth/login', {
      email,
      password,
    });
    return res.data;
  },

  async getMe(options = {}) {
    const res = await api.get('/auth/me', {
      timeout: options.timeout || 10000,
    });
    return res.data;
  },
};

// ================= ISSUE SERVICE =================
export const issueService = {
  async getAll(params = {}) {
    const res = await api.get('/issues', { params });
    return res.data;
  },

  async getById(id) {
    const res = await api.get(`/issues/${id}`);
    return res.data;
  },

  async create(issueData) {
    const res = await api.post('/issues', issueData);
    return res.data;
  },

  async getMy() {
    const res = await api.get('/issues/my');
    return res.data;
  },

  async getNearby(latitude, longitude, radiusKm = 5, params = {}) {
    const res = await api.get('/issues/nearby', {
      params: { latitude, longitude, radiusKm, ...params },
    });
    return res.data;
  },

  async support(id) {
    const res = await api.post(`/issues/${id}/support`);
    return res.data;
  },

  async removeSupport(id) {
    const res = await api.delete(`/issues/${id}/support`);
    return res.data;
  },
};

// ================= USER SERVICE =================
export const userService = {
  async getProfile() {
    const res = await api.get('/users/me');
    return res.data;
  },

  async updateProfile(profileData) {
    const res = await api.patch('/users/me', profileData);
    return res.data;
  },
};

// ================= ADMIN SERVICE =================
export const adminService = {
  async getDashboard() {
    const res = await api.get('/admin/dashboard');
    return res.data;
  },

  async getAllIssues(params = {}) {
    const res = await api.get('/admin/issues', { params });
    return res.data;
  },

  async updateStatus(id, status, adminNote = '', confirmedUrgency) {
    const body = { status, adminNote };
    if (confirmedUrgency !== undefined) {
      body.confirmedUrgency = confirmedUrgency;
    }
    const res = await api.patch(`/admin/issues/${id}/status`, body);
    return res.data;
  },

  async updateUrgency(id, confirmedUrgency) {
    const res = await api.patch(`/admin/issues/${id}/urgency`, {
      confirmedUrgency,
    });
    return res.data;
  },

  async resolve(id, adminNote = '', resolutionImageUrl = '', confirmedUrgency) {
    const body = { adminNote, resolutionImageUrl };
    if (confirmedUrgency !== undefined) {
      body.confirmedUrgency = confirmedUrgency;
    }
    const res = await api.post(`/admin/issues/${id}/resolve`, body);
    return res.data;
  },

  async getUsers() {
    const res = await api.get('/admin/users');
    return res.data;
  },
};

// ================= NOTIFICATION SERVICE =================
export const notificationService = {
  async getAll(params = {}) {
    const res = await api.get('/notifications', { params });
    return res.data;
  },

  async getUnreadCount() {
    const res = await api.get('/notifications/unread-count');
    return res.data;
  },

  async markAsRead(id) {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
  },

  async markAllAsRead() {
    const res = await api.patch('/notifications/read-all');
    return res.data;
  },

  async registerPushToken(token) {
    const res = await api.post('/notifications/push-token', { token });
    return res.data;
  },

  async unregisterPushToken(token) {
    const res = await api.delete('/notifications/push-token', {
      data: { token },
    });
    return res.data;
  },
};

// ================= UPLOAD SERVICE =================
const getImageInfo = (imageInput) => {
  const isAssetObj = typeof imageInput === 'object' && imageInput !== null;
  const uri = isAssetObj ? imageInput.uri : imageInput;
  const fileName =
    (isAssetObj && imageInput.fileName) ||
    (uri ? uri.split('?')[0].split('/').pop() : '') ||
    `photo_${Date.now()}.jpg`;

  let mimeType = isAssetObj && imageInput.mimeType ? imageInput.mimeType.toLowerCase() : '';
  if (!mimeType) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'webp') mimeType = 'image/webp';
    else mimeType = 'image/jpeg';
  }
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

  return {
    uri,
    filename: fileName,
    mimeType,
    fileSize: isAssetObj ? imageInput.fileSize : null,
    base64: isAssetObj ? imageInput.base64 : null,
  };
};

// Native XMLHttpRequest keeps React Native FormData working on Expo SDK 58
const uploadMultipartWithXhr = (uri, filename, mimeType, token) =>
  new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('image', { uri, name: filename, type: mimeType });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/uploads/image`);
    xhr.timeout = 30000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onload = () => {
      let data = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = { message: xhr.responseText || 'Unexpected upload response' };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      if (xhr.status === 401 && unauthorizedHandler) unauthorizedHandler();
      reject(new Error(data.message || `Image upload failed (${xhr.status})`));
    };

    xhr.onerror = () =>
      reject(new Error(`Network error uploading photo to ${API_BASE_URL}/uploads/image.`));
    xhr.ontimeout = () => reject(new Error('Image upload timed out. Please try again.'));
    xhr.send(formData);
  });

const uploadBase64Json = async (base64, mimeType, fileName) => {
  const res = await api.post(
    '/uploads/image',
    { base64, mimeType, fileName },
    { timeout: 30000 }
  );
  return res.data;
};

export const uploadService = {
  async uploadImage(imageInput) {
    const { uri, filename, mimeType, fileSize, base64 } = getImageInfo(imageInput);

    if (!uri && !base64) {
      throw new Error('No photo selected for upload.');
    }
    if (fileSize && fileSize > 5 * 1024 * 1024) {
      throw new Error('Selected photo exceeds the 5MB upload size limit.');
    }

    const token = await tokenStorage.getToken();
    if (!token) {
      throw new Error('Authentication required before uploading photo.');
    }

    if (uri && typeof XMLHttpRequest !== 'undefined') {
      try {
        return await uploadMultipartWithXhr(uri, filename, mimeType, token);
      } catch (err) {
        if (!base64) throw err;
      }
    }

    return uploadBase64Json(base64, mimeType, filename);
  },
};

export default api;
