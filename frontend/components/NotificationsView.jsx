import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import Header from './Header';
import Loading from './Loading';
import EmptyState from './EmptyState';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../constants/theme';

const NOTIFICATION_META = {
  ISSUE_SUBMITTED: {
    icon: 'checkmark-circle-outline',
    color: COLORS.primary,
    bg: COLORS.primaryLight,
  },
  NEW_ISSUE_ADMIN: {
    icon: 'megaphone-outline',
    color: COLORS.secondary,
    bg: COLORS.secondaryLight,
  },
  STATUS_UPDATED: {
    icon: 'sync-outline',
    color: COLORS.inProgress,
    bg: COLORS.inProgressBg,
  },
  ISSUE_RESOLVED: {
    icon: 'shield-checkmark-outline',
    color: COLORS.resolved,
    bg: COLORS.resolvedBg,
  },
  ISSUE_SUPPORTED: {
    icon: 'thumbs-up-outline',
    color: COLORS.pending,
    bg: COLORS.pendingBg,
  },
  DEFAULT: {
    icon: 'notifications-outline',
    color: COLORS.primary,
    bg: COLORS.primaryLight,
  },
};

const getTypeMeta = (type) => NOTIFICATION_META[type] || NOTIFICATION_META.DEFAULT;

export default function NotificationsView({ role = 'citizen' }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    pushState,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications(false);
    }, [fetchNotifications])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications(true);
    setRefreshing(false);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(role === 'admin' ? '/(admin)/dashboard' : '/(citizen)/home');
    }
  };

  const handleMarkSingleRead = async (notificationId) => {
    const result = await markAsRead(notificationId);
    if (!result?.success) {
      Alert.alert(
        'Update Failed',
        result?.error || 'Could not mark notification as read.'
      );
    }
  };

  const handleMarkAllRead = async () => {
    const result = await markAllAsRead();
    if (!result?.success) {
      Alert.alert(
        'Update Failed',
        result?.error || 'Could not mark all notifications as read.'
      );
    }
  };

  const handleOpenNotification = async (item) => {
    if (openingId === item._id) return;
    setOpeningId(item._id);
    try {
      if (!item.isRead) {
        await markAsRead(item._id);
      }

      const issueId = item.issue?._id || (typeof item.issue === 'string' ? item.issue : null);
      if (!issueId) {
        Alert.alert(
          'Complaint Unavailable',
          'This complaint is no longer available or has been deleted.'
        );
        return;
      }

      router.push(
        role === 'admin'
          ? `/(admin)/issues/${issueId}`
          : `/(citizen)/issues/${issueId}`
      );
    } finally {
      setOpeningId(null);
    }
  };

  const accentColor = role === 'admin' ? COLORS.secondary : COLORS.primary;

  const renderItem = ({ item }) => {
    const meta = getTypeMeta(item.type);
    const dateObj = item.createdAt ? new Date(item.createdAt) : null;
    const issueId = item.issue?._id || (typeof item.issue === 'string' ? item.issue : null);

    return (
      <TouchableOpacity
        activeOpacity={0.78}
        onPress={() => handleOpenNotification(item)}
        style={[
          styles.card,
          !item.isRead && [
            styles.unreadCard,
            { borderLeftColor: accentColor },
          ],
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>

        <View style={styles.contentCol}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item.title}</Text>
            {!item.isRead ? (
              <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />
            ) : null}
          </View>

          <Text style={styles.message}>{item.message}</Text>

          <View style={styles.metaRow}>
            {dateObj ? (
              <Text style={styles.timestamp}>
                {dateObj.toLocaleDateString()} •{' '}
                {dateObj.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            ) : null}

            <View style={styles.actionsInline}>
              {!item.isRead ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    handleMarkSingleRead(item._id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.markReadChip}
                >
                  <Text style={[styles.markReadText, { color: accentColor }]}>
                    Mark read
                  </Text>
                </TouchableOpacity>
              ) : null}

              {issueId ? (
                <Text style={[styles.viewIssueText, { color: accentColor }]}>
                  {item.issue?.resolutionImageUrl && item.type === 'ISSUE_RESOLVED'
                    ? 'Review Proof →'
                    : 'View →'}
                </Text>
              ) : (
                <Text style={styles.removedText}>Complaint removed</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderBody = () => {
    if (loading && !refreshing && notifications.length === 0) {
      return <Loading message="Loading notifications..." fullScreen />;
    }

    if (error) {
      return (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => fetchNotifications(false)}
            style={[styles.retryBtn, { backgroundColor: accentColor }]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.xl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[accentColor]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="No Notifications Yet"
            description={
              role === 'admin'
                ? 'New street issue alerts will appear here when citizens report problems.'
                : 'You will receive alerts here when you report issues or admins update your complaint status.'
            }
          />
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <Header
        title="Notifications"
        subtitle={
          unreadCount > 0 ? `${unreadCount} unread alert(s)` : 'All caught up'
        }
        showBack
        onBack={handleBack}
        rightComponent={
          unreadCount > 0 ? (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={styles.markAllBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.markAllText, { color: accentColor }]}>
                Mark all read
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Push Mode Notice (Permission denied or Expo Go informational banner) */}
      {(pushState.permission === 'denied' || pushState.isExpoGo) ? (
        <View style={styles.infoBanner}>
          <Ionicons
            name={
              pushState.permission === 'denied'
                ? 'notifications-off-outline'
                : 'information-circle-outline'
            }
            size={16}
            color={COLORS.textSecondary}
          />
          <Text style={styles.infoBannerText}>
            {pushState.permission === 'denied'
              ? 'Push notifications are disabled in settings. In-app alerts still update here.'
              : 'In-app notifications are live. Remote background push requires a standalone EAS APK build.'}
          </Text>
        </View>
      ) : null}

      {renderBody()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  markAllBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  markAllText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  infoBannerText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  listContent: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.card,
  },
  unreadCard: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm + 2,
  },
  contentCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  message: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.xs + 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  timestamp: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  actionsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  markReadChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '700',
  },
  viewIssueText: {
    fontSize: 11,
    fontWeight: '700',
  },
  removedText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
