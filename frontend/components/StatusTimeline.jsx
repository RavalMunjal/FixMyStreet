import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STATUSES, normalizeStatusLabel } from '../constants/categories';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme';

const STAGE_COLORS = {
  Reported: COLORS.pending,
  'Under Review': COLORS.underReview,
  'In Progress': COLORS.inProgress,
  Resolved: COLORS.resolved,
};

const getActorLabel = (entry) => {
  const actorRole = entry?.updatedByRole || entry?.updatedBy?.role;
  const actorName = entry?.updatedBy?.name;
  const roleLabel = actorRole === 'admin' ? 'Admin' : 'Citizen';

  if (actorName) return `${roleLabel} (${actorName})`;
  if (actorRole === 'admin') return 'Municipal Admin';
  if (actorRole === 'citizen') return 'Citizen';
  return null;
};

export default function StatusTimeline({ statusHistory = [], currentStatus }) {
  const normalizedCurrent = normalizeStatusLabel(currentStatus);
  const historyList = Array.isArray(statusHistory) ? statusHistory : [];

  const getEntryForStage = (stageId) => {
    const matches = historyList.filter(
      (h) => normalizeStatusLabel(h.status) === stageId
    );
    return matches.length > 0 ? matches[matches.length - 1] : null;
  };

  return (
    <View style={styles.wrapper}>
      {STATUSES.map((stage, index) => {
        const entry = getEntryForStage(stage.id);
        const isCurrent = normalizedCurrent === stage.id;
        const isReached = Boolean(entry) || isCurrent;
        const isLast = index === STATUSES.length - 1;
        const stageColor = isReached
          ? STAGE_COLORS[stage.id] || COLORS.pending
          : COLORS.borderDark;

        const dateObj = entry?.updatedAt ? new Date(entry.updatedAt) : null;
        const actorLabel = getActorLabel(entry);

        return (
          <View key={stage.id} style={styles.stepRow}>
            {/* Left Vertical Line & Icon Node */}
            <View style={styles.railCol}>
              <View
                style={[
                  styles.nodeCircle,
                  {
                    backgroundColor: isReached ? stageColor : COLORS.surfaceAlt,
                    borderColor: stageColor,
                  },
                ]}
              >
                <Ionicons
                  name={stage.icon}
                  size={16}
                  color={isReached ? '#ffffff' : COLORS.textMuted}
                />
              </View>
              {!isLast ? (
                <View
                  style={[
                    styles.connectorLine,
                    {
                      backgroundColor: isReached ? stageColor : COLORS.border,
                    },
                  ]}
                />
              ) : null}
            </View>

            {/* Right Content */}
            <View style={[styles.contentCol, isLast && styles.lastContentCol]}>
              <View style={styles.stageHeader}>
                <Text
                  style={[
                    styles.stageTitle,
                    !isReached && styles.stageTitlePending,
                  ]}
                >
                  {stage.label}
                </Text>
                {isCurrent ? (
                  <View
                    style={[
                      styles.currentPill,
                      { backgroundColor: `${stageColor}20` },
                    ]}
                  >
                    <Text style={[styles.currentPillText, { color: stageColor }]}>
                      Current
                    </Text>
                  </View>
                ) : null}
              </View>

              {entry ? (
                <View style={styles.metaBox}>
                  {dateObj ? (
                    <Text style={styles.dateTimeText}>
                      {dateObj.toLocaleDateString()} at{' '}
                      {dateObj.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  ) : null}
                  {actorLabel ? (
                    <Text style={styles.actorText}>Updated by: {actorLabel}</Text>
                  ) : null}
                  {entry.note ? (
                    <Text style={styles.noteText}>{entry.note}</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.awaitingText}>
                  Not yet updated to this stage
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: SPACING.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  railCol: {
    width: 34,
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  nodeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorLine: {
    width: 2.5,
    flex: 1,
    minHeight: 24,
    marginVertical: 2,
  },
  contentCol: {
    flex: 1,
    paddingBottom: SPACING.md,
  },
  lastContentCol: {
    paddingBottom: 0,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: 2,
  },
  stageTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  stageTitlePending: {
    color: COLORS.textMuted,
  },
  currentPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  currentPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaBox: {
    marginTop: 2,
  },
  dateTimeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  actorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  noteText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginTop: 4,
  },
  awaitingText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});
