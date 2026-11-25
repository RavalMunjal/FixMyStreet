const cloudinary = require('../config/cloudinary');

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

// @desc    Upload an image to Cloudinary (with safe local-dev Data URI fallback when unconfigured)
// @route   POST /api/uploads/image
// @access  Private
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file was provided for upload',
      });
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
          stream.end(req.file.buffer);
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
    const mimeType = (req.file.mimetype || 'image/jpeg').toLowerCase();
    const base64Data = req.file.buffer.toString('base64');
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
    const statusCode = error.http_code && error.http_code >= 400 ? error.http_code : 500;
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
