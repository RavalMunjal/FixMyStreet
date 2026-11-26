const mongoose = require('mongoose');

// Ensure MongoDB is connected before querying
const checkDB = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      message:
        'Database connection pending. Please verify MONGODB_URI in your environment settings.',
    });
    return false;
  }
  return true;
};

// Escape regex characters in search strings so Mongo queries stay safe
const escapeRegex = (text = '') => {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Safely parse page and limit query numbers
const parsePagination = (page = 1, limit = 50, maxLimit = 100) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 50));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

// Validate latitude (-90..90) and longitude (-180..180)
const parseValidCoordinates = (latitude, longitude) => {
  if (
    latitude === undefined ||
    latitude === null ||
    latitude === '' ||
    longitude === undefined ||
    longitude === null ||
    longitude === ''
  ) {
    return null;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
};

// Calculate distance in kilometers between two GPS points
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const distance = 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number(distance.toFixed(2));
};

// Support both "Reported" and older "Pending" records in status filters
const buildStatusFilter = (status) => {
  if (!status || status === 'All') return null;
  if (status === 'Reported') return { $in: ['Reported', 'Pending'] };
  return status;
};

module.exports = {
  checkDB,
  escapeRegex,
  parsePagination,
  parseValidCoordinates,
  calculateDistanceKm,
  buildStatusFilter,
};
