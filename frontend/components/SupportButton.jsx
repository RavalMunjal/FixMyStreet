import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { issueService } from '../services/api';
import { COLORS, RADIUS, SPACING, FONT_SIZE } from '../constants/theme';

export default function SupportButton({
  issue,
  currentUserId,
  onUpdated,
  compact = false,
}) {
  const [loading, setLoading] = useState(false);

  const supporters = Array.isArray(issue?.supporters) ? issue.supporters : [];
  const supportCount =
    typeof issue?.supportCount === 'number'
      ? issue.supportCount
      : supporters.length;

  const isSupported = Boolean(
    currentUserId &&
      supporters.some(
        (s) => (typeof s === 'string' ? s : s?._id) === currentUserId
      )
  );

  const handlePress = async () => {
    if (loading || !issue?._id) return;

    try {
      setLoading(true);
      const res = isSupported
        ? await issueService.removeSupport(issue._id)
        : await issueService.support(issue._id);

      if (res?.data?.issue && onUpdated) {
        onUpdated(res.data.issue);
      }
    } catch (err) {
      Alert.alert(
        'Support Action Failed',
        err.message || 'Unable to update support right now. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={loading}
      style={[
        styles.button,
        compact && styles.buttonCompact,
        isSupported ? styles.buttonSupported : styles.buttonDefault,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isSupported ? '#ffffff' : COLORS.primary}
        />
      ) : (
        <View style={styles.row}>
          <Ionicons
            name={isSupported ? 'thumbs-up' : 'thumbs-up-outline'}
            size={compact ? 14 : 16}
            color={isSupported ? '#ffffff' : COLORS.primary}
          />
          <Text
            style={[
              styles.label,
              compact && styles.labelCompact,
              isSupported ? styles.labelSupported : styles.labelDefault,
            ]}
          >
            {isSupported ? 'Supporting' : 'I Face This Too'}
          </Text>
          <View
            style={[
              styles.countPill,
              isSupported ? styles.countPillSupported : styles.countPillDefault,
            ]}
          >
            <Text
              style={[
                styles.countText,
                isSupported ? styles.countTextSupported : styles.countTextDefault,
              ]}
            >
              {supportCount}
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
  },
  buttonCompact: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    minHeight: 30,
  },
  buttonDefault: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
  },
  buttonSupported: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  labelCompact: {
    fontSize: 11,
  },
  labelDefault: {
    color: COLORS.primary,
  },
  labelSupported: {
    color: '#ffffff',
  },
  countPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  countPillDefault: {
    backgroundColor: COLORS.primaryLight,
  },
  countPillSupported: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
  },
  countTextDefault: {
    color: COLORS.primaryDark,
  },
  countTextSupported: {
    color: '#ffffff',
  },
});
