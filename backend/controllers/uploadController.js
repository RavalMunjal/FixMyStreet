const cloudinary = require('../config/cloudinary');

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const isPlaceholderValue = (value) => {
  if (!value || typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return (
    trimmed.startsWith('your_') ||
    trimmed.startsWith('<') ||
    trimmed === 'changeme'
  );
};

// Read uploaded image bytes from either multipart file or JSON base64 payload
const extractImageBuffer = (req) => {
  if (req.file) {
    return {
      buffer: req.file.buffer,
      mimeType: (req.file.mimetype || 'image/jpeg').toLowerCase(),
    };
  }

  if (!req.body?.base64) {
    return { errorStatus: 400, errorMessage: 'No image file was provided for upload' };
  }

  let rawBase64 = String(req.body.base64).trim();
  let mimeType = req.body.mimeType
    ? String(req.body.mimeType).toLowerCase()
    : 'image/jpeg';

  const dataUrlMatch = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(rawBase64);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    rawBase64 = dataUrlMatch[2];
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      errorStatus: 400,
      errorMessage: `Invalid file type (${mimeType}). Only JPEG, JPG, PNG, and WEBP images are accepted.`,
    };
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    return {
      errorStatus: 400,
      errorMessage: 'Image size exceeds maximum limit of 5MB',
    };
  }

  return { buffer, mimeType };
};

// @desc    Upload an image (supports multipart/form-data OR JSON base64 fallback)
// @route   POST /api/uploads/image
// @access  Private
const uploadImage = async (req, res) => {
  try {
    const parsed = extractImageBuffer(req);
    if (parsed.errorStatus) {
      return res.status(parsed.errorStatus).json({
        success: false,
        message: parsed.errorMessage,
      });
    }

    const imageBuffer = parsed.buffer;
    let mimeType = parsed.mimeType;

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image file was provided for upload',
      });
    }

    if (mimeType === 'image/jpg') {
      mimeType = 'image/jpeg';
    }

    const hasCloudinaryCredentials =
      !isPlaceholderValue(process.env.CLOUDINARY_CLOUD_NAME) &&
      !isPlaceholderValue(process.env.CLOUDINARY_API_KEY) &&
      !isPlaceholderValue(process.env.CLOUDINARY_API_SECRET);

    if (hasCloudinaryCredentials) {
      const uploadStream = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'fixmystreet/issues',
              resource_type: 'image',
              transformation: [
                { width: 1200, height: 1200, crop: 'limit' },
                { quality: 'auto' },
                { fetch_format: 'auto' },
              ],
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          stream.end(imageBuffer);
        });

      const result = await uploadStream();

      return res.status(201).json({
        success: true,
        message: 'Image uploaded to Cloudinary successfully',
        data: {
          url: result.secure_url,
          public_id: result.public_id,
        },
      });
    }

    // Safe fallback when Cloudinary credentials are placeholder/unconfigured in local dev
    const base64Data = imageBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    return res.status(201).json({
      success: true,
      message: 'Image uploaded successfully (local storage mode)',
      data: {
        url: dataUri,
        public_id: `local_${Date.now()}`,
      },
    });
  } catch (error) {
    console.error('Image upload failed:', error);
    const statusCode =
      error.http_code && error.http_code >= 400 ? error.http_code : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message
        ? `Image upload failed: ${error.message}`
        : 'Failed to upload image. Please try again.',
    });
  }
};

module.exports = {
  uploadImage,
};
