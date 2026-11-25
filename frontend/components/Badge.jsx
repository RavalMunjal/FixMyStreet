import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING, FONT_SIZE } from '../constants/theme';
import { normalizeStatusLabel } from '../constants/categories';

export default function Badge({
  label,
  status, // 'Reported' | 'Under Review' | 'In Progress' | 'Resolved' | 'Pending'
  category,
  urgency, // 'Normal' | 'High'
  size = 'md', // 'sm' | 'md'
  style,
}) {
  const getStyles = () => {
    if (urgency) {
      if (urgency === 'High') {
        return {
          bg: COLORS.dangerBg,
          text: COLORS.danger,
          border: COLORS.dangerBorder,
        };
      }
      return {
        bg: COLORS.surfaceAlt,
        text: COLORS.textSecondary,
        border: COLORS.border,
      };
    }

    if (category) {
      return {
        bg: COLORS.surfaceAlt,
        text: COLORS.textSecondary,
        border: COLORS.border,
      };
    }

    const displayStatus = normalizeStatusLabel(status);
    switch (displayStatus) {
      case 'Reported':
        return {
          bg: COLORS.pendingBg,
          text: COLORS.pending,
          border: COLORS.pendingBorder,
        };
      case 'Under Review':
        return {
          bg: COLORS.underReviewBg,
          text: COLORS.underReview,
          border: COLORS.underReviewBorder,
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

  const badgeColors = getStyles();
  const displayText =
    label ||
    (urgency ? `${urgency} Urgency` : null) ||
    (status ? normalizeStatusLabel(status) : null) ||
    category;

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' ? styles.badgeSm : styles.badgeMd,
        {
          backgroundColor: badgeColors.bg,
          borderColor: badgeColors.border,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: badgeColors.text },
        ]}
      >
        {displayText}
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
