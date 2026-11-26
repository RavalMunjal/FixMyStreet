import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import Badge from './Badge';
import SupportButton from './SupportButton';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme';

/**
 * Shared issue summary card reused across Citizen and Admin screens.
 */
export default function IssueCard({
  issue,
  onPress,
  showSupportButton = false,
  currentUserId,
  onIssueUpdated,
  showRequestedUrgency = false,
  showReporter = false,
  showAddress = true,
  datePrefix = '',
  showAdminNote = false,
  footerPrompt = '',
  style,
}) {
  if (!issue) return null;

  return (
    <Card onPress={onPress} style={[styles.card, style]}>
      {/* Category, Urgency, and Status Badges */}
      <View style={styles.cardHeader}>
        <View style={styles.badgeGroup}>
          <Badge category={issue.category} size="sm" />
          {issue.confirmedUrgency === 'High' ? (
            <Badge urgency="High" size="sm" />
          ) : showRequestedUrgency && issue.requestedUrgency === 'High' ? (
            <Badge urgency="High" size="sm" label="Req: High" />
          ) : null}
        </View>
        <Badge status={issue.status} size="sm" />
      </View>

      {/* Main Content Row */}
      <View style={styles.cardBody}>
        {issue.imageUrl ? (
          <Image source={{ uri: issue.imageUrl }} style={styles.thumb} />
        ) : null}

        <View style={styles.infoCol}>
          <Text style={styles.title} numberOfLines={1}>
            {issue.title}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {issue.description}
          </Text>

          {showReporter ? (
            <Text style={styles.metaText} numberOfLines={1}>
              By: {issue.reportedBy?.name || 'Citizen'} • {issue.supportCount || 0} supporters
            </Text>
          ) : showAddress ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {issue.distanceKm !== undefined ? `${issue.distanceKm} km • ` : ''}
                {issue.address || 'GPS Coordinates'}
              </Text>
            </View>
          ) : null}

          {datePrefix && issue.createdAt ? (
            <Text style={styles.dateText}>
              {datePrefix}
              {new Date(issue.createdAt).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Optional Admin Note */}
      {showAdminNote && issue.adminNote ? (
        <View style={styles.adminNoteBox}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.primary} />
          <Text style={styles.adminNoteText} numberOfLines={1}>
            Admin: {issue.adminNote}
          </Text>
        </View>
      ) : null}

      {/* Optional Citizen Support Footer */}
      {showSupportButton ? (
        <View style={styles.cardFooter}>
          <SupportButton
            issue={issue}
            currentUserId={currentUserId}
            onUpdated={onIssueUpdated}
            compact
          />
          <Text style={styles.detailsLink}>Details →</Text>
        </View>
      ) : null}

      {/* Optional Admin Action Footer */}
      {footerPrompt ? (
        <View style={styles.actionRow}>
          <Text style={styles.actionPrompt}>{footerPrompt}</Text>
          <Ionicons name="create-outline" size={16} color={COLORS.secondary} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  badgeGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    flex: 1,
  },
  cardBody: {
    flexDirection: 'row',
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
    marginRight: SPACING.md,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  description: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  metaText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  adminNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
  },
  adminNoteText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primaryDark,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailsLink: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionPrompt: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.secondary,
    fontWeight: '600',
  },
});
