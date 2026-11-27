import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING, FONT_SIZE } from '../constants/theme';
import { normalizeStatusLabel } from '../constants/categories';

const DEFAULT_COLORS = {
  bg: COLORS.surfaceAlt,
  text: COLORS.textSecondary,
  border: COLORS.border,
};

const STATUS_COLORS = {
  Reported: {
    bg: COLORS.pendingBg,
    text: COLORS.pending,
    border: COLORS.pendingBorder,
  },
  'Under Review': {
    bg: COLORS.underReviewBg,
    text: COLORS.underReview,
    border: COLORS.underReviewBorder,
  },
  'In Progress': {
    bg: COLORS.inProgressBg,
    text: COLORS.inProgress,
    border: COLORS.inProgressBorder,
  },
  Resolved: {
    bg: COLORS.resolvedBg,
    text: COLORS.resolved,
    border: COLORS.resolvedBorder,
  },
};

export default function Badge({
  label,
  status, // 'Reported' | 'Under Review' | 'In Progress' | 'Resolved' | 'Pending'
  category,
  urgency, // 'Normal' | 'High'
  size = 'md', // 'sm' | 'md'
  style,
}) {
  const getBadgeColors = () => {
    if (urgency === 'High') {
      return {
        bg: COLORS.dangerBg,
        text: COLORS.danger,
        border: COLORS.dangerBorder,
      };
    }
    if (urgency || category) {
      return DEFAULT_COLORS;
    }
    return STATUS_COLORS[normalizeStatusLabel(status)] || DEFAULT_COLORS;
  };

  const getBadgeText = () => {
    if (label) return label;
    if (urgency) return `${urgency} Urgency`;
    if (status) return normalizeStatusLabel(status);
    return category;
  };

  const badgeColors = getBadgeColors();
  const displayText = getBadgeText();

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
