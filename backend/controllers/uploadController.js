const cloudinary = require('../config/cloudinary');

// @desc    Upload an image to Cloudinary (with fallback for local dev)
// @route   POST /api/uploads/image
// @access  Private
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file was provided for upload',
      });
    }

    const hasCloudinaryCredentials =
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET &&
      process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

    if (hasCloudinaryCredentials) {
      // Upload stream to Cloudinary
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
    } else {
      // Safe fallback when Cloudinary is not yet configured:
      // Return data URI so mobile app displays the photo seamlessly during testing
      const base64Data = req.file.buffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64Data}`;

      return res.status(201).json({
        success: true,
        message: 'Image processed successfully (Development Data URI mode)',
        data: {
          url: dataUri,
          public_id: `local_fallback_${Date.now()}`,
        },
      });
    }
  } catch (error) {
    console.error('Image upload failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image. Please try again.',
    });
  }
};

module.exports = {
  uploadImage,
};
