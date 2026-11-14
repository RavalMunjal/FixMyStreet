const User = require('../models/User');
const Issue = require('../models/Issue');

// @desc    Get current user profile with complaint statistics
// @route   GET /api/users/me
// @access  Private
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    const totalComplaints = await Issue.countDocuments({
      reportedBy: user._id,
    });

    const pendingCount = await Issue.countDocuments({
      reportedBy: user._id,
      status: 'Pending',
    });

    const inProgressCount = await Issue.countDocuments({
      reportedBy: user._id,
      status: 'In Progress',
    });

    const resolvedCount = await Issue.countDocuments({
      reportedBy: user._id,
      status: 'Resolved',
    });

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
        stats: {
          totalComplaints,
          pendingCount,
          inProgressCount,
          resolvedCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user profile
// @route   PATCH /api/users/me
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (name) {
      user.name = name.trim();
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      const existingUser = await User.findOne({
        email: email.toLowerCase().trim(),
      });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'This email is already in use by another account',
        });
      }
      user.email = email.toLowerCase().trim();
    }

    // Password change verification
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to change your password',
        });
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password provided is incorrect',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long',
        });
      }

      user.passwordHash = await User.hashPassword(newPassword);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
