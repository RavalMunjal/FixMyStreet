const Notification = require('../models/Notification');
const User = require('../models/User');

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

const isValidExpoPushToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  const hasPrefix =
    trimmed.startsWith('ExponentPushToken[') ||
    trimmed.startsWith('ExpoPushToken[');
  return hasPrefix && trimmed.endsWith(']');
};

// Send push notifications via Expo Push API and remove unregistered device tokens
const sendExpoPushNotifications = async (tokens = [], payload = {}) => {
  try {
    const validTokens = [...new Set(tokens.filter(isValidExpoPushToken))];
    if (validTokens.length === 0) return { sent: 0 };

    const messages = validTokens.map((to) => ({
      to,
      sound: 'default',
      channelId: 'default',
      title: payload.title,
      body: payload.message,
      priority: payload.priority === 'normal' ? 'default' : 'high',
      data: payload.data || {},
    }));

    const badTokens = [];
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) continue;

      const result = await response.json();
      const tickets = Array.isArray(result?.data) ? result.data : [];

      tickets.forEach((ticket, idx) => {
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          badTokens.push(batch[idx].to);
        }
      });
    }

    if (badTokens.length > 0) {
      await User.updateMany(
        { pushTokens: { $in: badTokens } },
        { $pull: { pushTokens: { $in: badTokens } } }
      );
    }

    return { sent: validTokens.length - badTokens.length };
  } catch (err) {
    console.warn('Expo push delivery skipped:', err.message);
    return { sent: 0 };
  }
};

// Save in-app notification to MongoDB and send push message without breaking caller flows
const createAndSendNotification = async ({
  recipientId,
  senderId = null,
  issueId = null,
  type,
  title,
  message,
  dedupeKey = null,
  priority = 'high',
  targetRole = 'citizen',
}) => {
  try {
    if (!recipientId) return null;

    if (dedupeKey) {
      const existing = await Notification.findOne({
        recipient: recipientId,
        dedupeKey,
      });
      if (existing) return existing;
    }

    const doc = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      issue: issueId,
      type,
      title,
      message,
      isRead: false,
      dedupeKey: dedupeKey || undefined,
    });

    const recipient = await User.findById(recipientId).select('pushTokens');
    if (recipient?.pushTokens?.length > 0) {
      sendExpoPushNotifications(recipient.pushTokens, {
        title,
        message,
        priority,
        data: {
          notificationId: doc._id.toString(),
          issueId: issueId ? issueId.toString() : undefined,
          type,
          targetRole,
        },
      });
    }

    return doc;
  } catch (error) {
    if (error?.code !== 11000) {
      console.warn('Notification creation failed:', error.message);
    }
    return null;
  }
};

// Notify citizen when an admin updates complaint status or marks it resolved
const notifyIssueStatusChange = async ({
  issue,
  reporterId,
  adminId,
  status,
  previousStatus,
}) => {
  if (status === 'Resolved') {
    await createAndSendNotification({
      recipientId: reporterId,
      senderId: adminId,
      issueId: issue._id,
      type: 'ISSUE_RESOLVED',
      title: 'Your Issue Has Been Resolved',
      message: issue.resolutionImageUrl
        ? `Your reported issue ${issue.title} has been marked as resolved. Open details to review the resolution proof.`
        : `Your reported issue ${issue.title} has been marked as resolved.`,
      targetRole: 'citizen',
    });
    return;
  }

  if (previousStatus !== status) {
    await createAndSendNotification({
      recipientId: reporterId,
      senderId: adminId,
      issueId: issue._id,
      type: 'STATUS_UPDATED',
      title: 'Issue Status Updated',
      message: `Your complaint ${issue.title} has been updated to ${status}.`,
      targetRole: 'citizen',
    });
  }
};

// Find admins responsible for this issue's organization, category, or area
const findResponsibleAdminsForIssue = async (issue) => {
  try {
    const admins = await User.find({ role: 'admin' }).select(
      '_id organization assignedCategories assignedArea'
    );

    const issueOrg = (issue.organization || '').trim().toLowerCase();
    const issueAddr = (issue.address || '').trim().toLowerCase();

    return admins.filter((admin) => {
      const adminOrg = (admin.organization || '').trim().toLowerCase();
      const adminCats = Array.isArray(admin.assignedCategories)
        ? admin.assignedCategories
        : [];
      const adminArea = (admin.assignedArea || '').trim().toLowerCase();

      if (adminOrg && adminOrg !== issueOrg) return false;
      if (adminCats.length > 0 && !adminCats.includes(issue.category)) return false;
      if (adminArea && !issueAddr.includes(adminArea)) return false;

      return true;
    });
  } catch (err) {
    console.warn('Failed to find responsible admins:', err.message);
    return [];
  }
};

module.exports = {
  isValidExpoPushToken,
  sendExpoPushNotifications,
  createAndSendNotification,
  notifyIssueStatusChange,
  findResponsibleAdminsForIssue,
};
