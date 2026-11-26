const Notification = require('../models/Notification');
const User = require('../models/User');
const { checkDB, parsePagination } = require('../utils/helpers');
const { isValidExpoPushToken } = require('../utils/notificationService');

// @desc    Get notifications for logged-in user (newest first)
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const { page = 1, limit = 50 } = req.query;
    const pagination = parsePagination(page, limit, 100);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .populate('issue', 'title category status resolutionImageUrl')
        .populate('sender', 'name role')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      Notification.countDocuments({ recipient: req.user._id }),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: {
        total,
        unreadCount,
        page: pagination.page,
        count: notifications.length,
        notifications,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread notification count for logged-in user
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      message: 'Unread notification count retrieved',
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a single notification as read (enforces ownership)
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    )
      .populate('issue', 'title category status resolutionImageUrl')
      .populate('sender', 'name role');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: {
        notification,
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read for logged-in user
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        unreadCount: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register or update an Expo Push Token for the authenticated user
// @route   POST /api/notifications/push-token
// @access  Private
const registerPushToken = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const { token } = req.body;
    const trimmed = typeof token === 'string' ? token.trim() : '';

    if (!isValidExpoPushToken(trimmed)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid Expo push token format. Expected ExponentPushToken[...] or ExpoPushToken[...].',
      });
    }

    // Disassociate this physical device token from any previous user account
    await User.updateMany(
      { _id: { $ne: req.user._id }, pushTokens: trimmed },
      { $pull: { pushTokens: trimmed } }
    );

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { pushTokens: trimmed } },
      { new: true }
    ).select('pushTokens');

    res.status(200).json({
      success: true,
      message: 'Push notification token registered successfully',
      data: {
        tokenCount: updatedUser?.pushTokens?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unregister device push token (called on logout)
// @route   DELETE /api/notifications/push-token
// @access  Private
const unregisterPushToken = async (req, res, next) => {
  try {
    if (!checkDB(res)) return;

    const token =
      typeof req.body?.token === 'string' ? req.body.token.trim() : '';

    if (token) {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { pushTokens: token },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Push token removed',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  registerPushToken,
  unregisterPushToken,
};
