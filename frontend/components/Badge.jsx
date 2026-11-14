import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING, FONT_SIZE } from '../constants/theme';

export default function Badge({
  label,
  status, // 'Pending' | 'In Progress' | 'Resolved'
  category,
  size = 'md', // 'sm' | 'md'
  style,
}) {
  const getStatusStyles = () => {
    switch (status) {
      case 'Pending':
        return {
          bg: COLORS.pendingBg,
          text: COLORS.pending,
          border: COLORS.pendingBorder,
        };
      case 'In Progress':
        return {
          bg: COLORS.inProgressBg,
          text: COLORS.inProgress,
          border: COLORS.inProgressBorder,
        };
      case 'Resolved':
        return {
          bg: COLORS.resolvedBg,
          text: COLORS.resolved,
          border: COLORS.resolvedBorder,
        };
      default:
        return {
          bg: COLORS.surfaceAlt,
          text: COLORS.textSecondary,
          border: COLORS.border,
        };
    }
  };

  const statusColors = getStatusStyles();

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' ? styles.badgeSm : styles.badgeMd,
        {
          backgroundColor: statusColors.bg,
          borderColor: statusColors.border,
        },
        category && styles.categoryBadge,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: category ? COLORS.textSecondary : statusColors.text },
        ]}
      >
        {label || status || category}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  categoryBadge: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
  },
  text: {
    fontWeight: '600',
  },
  textSm: {
    fontSize: FONT_SIZE.xs,
  },
  textMd: {
    fontSize: FONT_SIZE.sm,
  },
});
