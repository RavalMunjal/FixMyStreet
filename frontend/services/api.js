import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { tokenStorage } from './storage';

// Create base Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
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

// Response Interceptor: centralized error extraction
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred. Please try again.';

    if (error.response) {
      // Server returned an error code
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
    } else if (error.request) {
      // Network error or server unreachable
      message =
        'Cannot connect to FixMyStreet server. Please check your internet connection or backend URL.';
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

  async getMe() {
    const res = await api.get('/auth/me');
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

  async getNearby(latitude, longitude, radiusKm = 15) {
    const res = await api.get('/issues/nearby', {
      params: { latitude, longitude, radiusKm },
    });
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

  async updateStatus(id, status, adminNote = '') {
    const res = await api.patch(`/admin/issues/${id}/status`, {
      status,
      adminNote,
    });
    return res.data;
  },

  async resolve(id, adminNote = '', resolutionImageUrl = '') {
    const res = await api.post(`/admin/issues/${id}/resolve`, {
      adminNote,
      resolutionImageUrl,
    });
    return res.data;
  },

  async getUsers() {
    const res = await api.get('/admin/users');
    return res.data;
  },
};

// ================= UPLOAD SERVICE =================
export const uploadService = {
  async uploadImage(imageUri) {
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || `photo_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('image', {
      uri: imageUri,
      name: filename,
      type,
    });

    const res = await api.post('/uploads/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return res.data;
  },
};

export default api;
