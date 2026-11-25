const multer = require('multer');

// Configure memory storage so files are held in buffer for validation & Cloudinary stream
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  const normalizedMime = (file.mimetype || '').toLowerCase();

  if (allowedMimeTypes.includes(normalizedMime)) {
    cb(null, true);
  } else {
    const err = new Error(
      `Invalid file type (${file.mimetype || 'unknown'}). Only JPEG, JPG, PNG, and WEBP images are accepted.`
    );
    err.statusCode = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});

module.exports = upload;
