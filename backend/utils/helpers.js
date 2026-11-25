const mongoose = require('mongoose');

/**
 * Verify MongoDB connection is active before executing queries.
 * Returns false and sends HTTP 503 if the database is disconnected.
 */
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

/**
 * Escape special regular expression characters from user search input
 * so arbitrary characters like "(" or "[" do not throw SyntaxError.
 */
const escapeRegex = (text = '') => {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Parse positive pagination integers safely with clamped limits.
 */
const parsePagination = (page = 1, limit = 50, maxLimit = 100) => {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (parsedPage - 1) * parsedLimit;
  return { page: parsedPage, limit: parsedLimit, skip };
};

module.exports = {
  checkDB,
  escapeRegex,
  parsePagination,
};
