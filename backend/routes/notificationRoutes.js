const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  registerPushToken,
  unregisterPushToken,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// All notification routes require JWT authentication
router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.post('/push-token', registerPushToken);
router.delete('/push-token', unregisterPushToken);

module.exports = router;
