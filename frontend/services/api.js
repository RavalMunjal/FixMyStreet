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

// ================= UPLOAD SERVICE =================
const normalizeMimeAndName = (imageInput) => {
  const isAssetObj = typeof imageInput === 'object' && imageInput !== null;
  const uri = isAssetObj ? imageInput.uri : imageInput;
  const rawName =
    (isAssetObj && imageInput.fileName) ||
    (uri ? uri.split('?')[0].split('/').pop() : '') ||
    `photo_${Date.now()}.jpg`;

  let mimeType = isAssetObj && imageInput.mimeType
    ? imageInput.mimeType.toLowerCase()
    : '';

  if (!mimeType) {
    const extMatch = /\.(\w+)$/.exec(rawName);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'webp') mimeType = 'image/webp';
    else mimeType = 'image/jpeg';
  }

  if (mimeType === 'image/jpg') {
    mimeType = 'image/jpeg';
  }

  const fileSize = isAssetObj ? imageInput.fileSize : null;
  return { uri, filename: rawName, mimeType, fileSize };
};

export const uploadService = {
  async uploadImage(imageInput) {
    const { uri, filename, mimeType, fileSize } = normalizeMimeAndName(imageInput);
    const base64 =
      typeof imageInput === 'object' && imageInput !== null
        ? imageInput.base64
        : null;

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

    // Use native XMLHttpRequest for React Native multipart upload (avoids Expo SDK 58 Winter fetch FormData restriction)
    const uploadViaXhr = () =>
      new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('image', {
          uri,
          name: filename,
          type: mimeType,
        });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/uploads/image`);
        xhr.timeout = 30000;
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.onload = () => {
          let parsed = {};
          try {
            parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          } catch (e) {
            parsed = { message: xhr.responseText || 'Unexpected upload response' };
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(parsed);
          } else {
            if (xhr.status === 401 && unauthorizedHandler) {
              unauthorizedHandler();
            }
            reject(
              new Error(
                parsed.message || `Image upload failed with status ${xhr.status}`
              )
            );
          }
        };

        xhr.onerror = () => {
          reject(
            new Error(
              `Network error uploading photo to ${API_BASE_URL}/uploads/image. Check Wi-Fi and backend server.`
            )
          );
        };

        xhr.ontimeout = () => {
          reject(new Error('Image upload timed out. Please try again.'));
        };

        xhr.send(formData);
      });

    try {
      if (uri && typeof XMLHttpRequest !== 'undefined') {
        return await uploadViaXhr();
      }
    } catch (xhrError) {
      // Fallback to JSON base64 upload if available and multipart failed
      if (base64) {
        const res = await api.post(
          '/uploads/image',
          {
            base64,
            mimeType,
            fileName: filename,
          },
          { timeout: 30000 }
        );
        return res.data;
      }
      throw xhrError;
    }

    // Direct base64 upload if uri wasn't present
    const res = await api.post(
      '/uploads/image',
      {
        base64,
        mimeType,
        fileName: filename,
      },
      { timeout: 30000 }
    );
    return res.data;
  },
};

export default api;
