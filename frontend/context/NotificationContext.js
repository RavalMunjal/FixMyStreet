import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/api';
import { registerForPushNotificationsAsync } from '../services/notifications';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated, isLoading: authLoading, setBeforeLogoutHook } =
    useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pushState, setPushState] = useState({
    token: null,
    permission: 'unknown',
    isExpoGo: false,
  });

  const pushTokenRef = useRef(null);
  const handledColdStartIdRef = useRef(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationService.getUnreadCount();
      if (typeof res?.data?.unreadCount === 'number') {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.warn('Unread count refresh error:', err.message);
    }
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(
    async (silent = false) => {
      if (!isAuthenticated) return;
      try {
        if (!silent) setLoading(true);
        setError('');
        const res = await notificationService.getAll({ limit: 50 });
        setNotifications(res?.data?.notifications || []);
        if (typeof res?.data?.unreadCount === 'number') {
          setUnreadCount(res.data.unreadCount);
        }
      } catch (err) {
        console.warn('Notifications fetch error:', err.message);
        if (!silent) {
          setError(err.message || 'Unable to load notifications.');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isAuthenticated]
  );

  const markAsRead = useCallback(
    async (notificationId) => {
      if (!notificationId || !isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }
      try {
        const res = await notificationService.markAsRead(notificationId);
        const updated = res?.data?.notification;
        if (updated) {
          setNotifications((prev) =>
            prev.map((n) => (n._id === updated._id ? updated : n))
          );
        }
        if (typeof res?.data?.unreadCount === 'number') {
          setUnreadCount(res.data.unreadCount);
        } else {
          await refreshUnreadCount();
        }
        return { success: true };
      } catch (err) {
        console.warn('Mark read error:', err.message);
        return {
          success: false,
          error: err.message || 'Unable to mark notification as read.',
        };
      }
    },
    [isAuthenticated, refreshUnreadCount]
  );

  const markAllAsRead = useCallback(async () => {
    if (!isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }
    try {
      const res = await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(res?.data?.unreadCount ?? 0);
      return { success: true };
    } catch (err) {
      const message = err.message || 'Failed to mark notifications as read.';
      setError(message);
      return { success: false, error: message };
    }
  }, [isAuthenticated]);

  const navigateFromNotificationData = useCallback(
    async (data) => {
      if (!data || !isAuthenticated) return;

      if (data.notificationId) {
        markAsRead(data.notificationId);
      }

      const basePath = user?.role === 'admin' ? '/(admin)' : '/(citizen)';
      if (data.issueId) {
        router.push(`${basePath}/issues/${data.issueId}`);
      } else {
        router.push(`${basePath}/notifications`);
      }
    },
    [isAuthenticated, user?.role, markAsRead, router]
  );

  // Register device push token & clean up on logout
  useEffect(() => {
    if (setBeforeLogoutHook) {
      setBeforeLogoutHook(async () => {
        if (pushTokenRef.current) {
          try {
            await notificationService.unregisterPushToken(pushTokenRef.current);
          } catch (e) {
            console.warn('Token unregister skipped:', e.message);
          }
        }
        pushTokenRef.current = null;
        setNotifications([]);
        setUnreadCount(0);
      });
    }
  }, [setBeforeLogoutHook]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications(false);

    let mounted = true;
    registerForPushNotificationsAsync().then((res) => {
      if (!mounted) return;
      pushTokenRef.current = res.token || null;
      setPushState({
        token: res.token || null,
        permission: res.permission || 'unknown',
        isExpoGo: Boolean(res.isExpoGo),
      });
    });

    // Periodic unread sync while active in foreground (15s)
    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        refreshUnreadCount();
      }
    }, 15000);

    // Refresh when app returns from background
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshUnreadCount();
      }
    });

    return () => {
      mounted = false;
      clearInterval(intervalId);
      appStateSub.remove();
    };
  }, [isAuthenticated, authLoading, fetchNotifications, refreshUnreadCount]);

  // Native notification listeners (foreground, background tap, terminated cold-start tap)
  useEffect(() => {
    if (Platform.OS === 'web' || !isAuthenticated || authLoading) return;

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      fetchNotifications(true);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data;
        navigateFromNotificationData(data);
      }
    );

    // Check if app was opened from terminated state via tapping a notification
    Notifications.getLastNotificationResponseAsync()
      .then((lastResponse) => {
        if (!lastResponse) return;
        const reqId = lastResponse?.notification?.request?.identifier;
        if (reqId && handledColdStartIdRef.current === reqId) return;
        handledColdStartIdRef.current = reqId;
        const data = lastResponse?.notification?.request?.content?.data;
        if (data) {
          navigateFromNotificationData(data);
        }
      })
      .catch(() => {});

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [
    isAuthenticated,
    authLoading,
    fetchNotifications,
    navigateFromNotificationData,
  ]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        pushState,
        fetchNotifications,
        refreshUnreadCount,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
