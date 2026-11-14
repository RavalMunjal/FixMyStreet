import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, RADIUS, SPACING, SHADOW } from '../constants/theme';

export default function Card({
  children,
  style,
  onPress,
  activeOpacity = 0.7,
}) {
  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPress={onPress}
        style={[styles.card, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
    marginBottom: SPACING.md,
  },
});
