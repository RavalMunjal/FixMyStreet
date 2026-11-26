import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { COLORS, RADIUS } from '../constants/theme';

export default function NotificationBell({ accentColor }) {
  const router = useRouter();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const iconColor =
    accentColor || (user?.role === 'admin' ? COLORS.secondary : COLORS.primary);

  const handlePress = () => {
    router.push(
      user?.role === 'admin'
        ? '/(admin)/notifications'
        : '/(citizen)/notifications'
    );
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.bellBtn}
      accessibilityLabel={`Notifications, ${unreadCount} unread`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="notifications-outline" size={21} color={iconColor} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
});
