const Notification = require('../models/Notification');
const User = require('../models/User');

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

const isValidExpoPushToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  return (
    trimmed.startsWith('ExponentPushToken[') ||
    trimmed.startsWith('ExpoPushToken[')
  ) && trimmed.endsWith(']');
};

/**
 * Send push notifications via Expo Push API and remove dead/unregistered tokens.
 * Failures are caught and logged so main API operations never fail.
 */
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
    // Send in batches of 100 per Expo Push API spec
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.warn(`Expo Push API returned HTTP ${response.status}`);
        continue;
      }

      const result = await response.json();
      const tickets = Array.isArray(result?.data) ? result.data : [];

      tickets.forEach((ticket, idx) => {
        if (
          ticket?.status === 'error' &&
          ticket?.details?.error === 'DeviceNotRegistered'
        ) {
          badTokens.push(chunk[idx].to);
        }
      });
    }

    if (badTokens.length > 0) {
      await User.updateMany(
        { pushTokens: { $in: badTokens } },
        { $pull: { pushTokens: { $in: badTokens } } }
      );
      console.log(`🧹 Cleaned ${badTokens.length} unregistered Expo push token(s)`);
    }

    return { sent: validTokens.length - badTokens.length };
  } catch (err) {
    console.warn('Expo push delivery failed safely:', err.message);
    return { sent: 0, error: err.message };
  }
};

/**
 * Persist an in-app Notification in MongoDB and dispatch Expo push notification.
 * Never throws so complaint/status mutations always succeed.
 */
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
      if (existing) {
        return existing;
      }
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
    if (recipient && Array.isArray(recipient.pushTokens) && recipient.pushTokens.length > 0) {
      // Dispatch push without blocking caller or throwing
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
      }).catch((e) => console.warn('Push dispatch error:', e.message));
    }

    return doc;
  } catch (error) {
    // Handle race-condition duplicate key gracefully
    if (error?.code === 11000) {
      return null;
    }
    console.warn('Notification creation failed safely:', error.message);
    return null;
  }
};

/**
 * Determine responsible admins for a newly submitted issue without notifying unrelated admins.
 */
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

      // If issue specifies a responsible organization, skip admins bound to a different org
      if (issueOrg && adminOrg && adminOrg !== issueOrg) {
        return false;
      }
      // If admin belongs to a specific organization when issue doesn't match, skip
      if (adminOrg && issueOrg && adminOrg !== issueOrg) {
        return false;
      }
      if (adminOrg && !issueOrg) {
        return false;
      }

      // If admin has specific category responsibilities, require match
      if (adminCats.length > 0 && !adminCats.includes(issue.category)) {
        return false;
      }

      // If admin is scoped to a specific area, require address match
      if (adminArea && !issueAddr.includes(adminArea)) {
        return false;
      }

      return true;
    });
  } catch (err) {
    console.warn('Failed to resolve responsible admins:', err.message);
    return [];
  }
};

module.exports = {
  isValidExpoPushToken,
  sendExpoPushNotifications,
  createAndSendNotification,
  findResponsibleAdminsForIssue,
};
