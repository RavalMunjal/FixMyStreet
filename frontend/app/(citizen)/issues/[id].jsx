import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../../components/Header';
import Badge from '../../../components/Badge';
import Card from '../../../components/Card';
import Loading from '../../../components/Loading';
import { issueService } from '../../../services/api';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../constants/theme';

export default function IssueDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDetails = async () => {
    try {
      setError('');
      const res = await issueService.getById(id);
      setIssue(res?.data?.issue);
    } catch (err) {
      console.warn('Error fetching issue details:', err);
      setError('Unable to load complaint details. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDetails();
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Complaint Details" showBack />
        <Loading message="Loading complaint details..." fullScreen />
      </SafeAreaView>
    );
  }

  if (error || !issue) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Complaint Details" showBack />
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>
            {error || 'Complaint not found or has been removed.'}
          </Text>
          <TouchableOpacity onPress={fetchDetails} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Complaint Details"
        subtitle={`ID: #${issue._id?.substring(issue._id.length - 6)}`}
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Issue Photo */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: issue.imageUrl }} style={styles.issueImage} />
          <View style={styles.badgesOverlay}>
            <Badge category={issue.category} />
            <Badge status={issue.status} />
          </View>
        </View>

        {/* Title & Metadata */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{issue.title}</Text>
          <View style={styles.reportedByRow}>
            <Ionicons name="person-circle-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.reportedByText}>
              Reported by {issue.reportedBy?.name || 'Citizen'} on{' '}
              {new Date(issue.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Description Card */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeading}>Description</Text>
          <Text style={styles.bodyText}>{issue.description}</Text>
        </Card>

        {/* Location Information Card */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeading}>Location Details</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.addressText}>
              {issue.address || 'Location captured via GPS'}
            </Text>
          </View>
          <Text style={styles.coordsText}>
            GPS Coordinates: {issue.latitude?.toFixed(5)}, {issue.longitude?.toFixed(5)}
          </Text>
        </Card>

        {/* Admin Resolution Section if available */}
        {(issue.adminNote || issue.resolutionImageUrl) && (
          <Card style={[styles.card, styles.resolutionCard]}>
            <View style={styles.resolutionHeader}>
              <Ionicons name="shield-checkmark" size={22} color={COLORS.resolved} />
              <Text style={styles.resolutionTitle}>Administrator Resolution</Text>
            </View>

            {issue.adminNote ? (
              <Text style={styles.resolutionNote}>{issue.adminNote}</Text>
            ) : null}

            {issue.resolutionImageUrl ? (
              <View style={styles.resolutionImageWrapper}>
                <Text style={styles.resolutionImageLabel}>Resolution Proof Photo:</Text>
                <Image
                  source={{ uri: issue.resolutionImageUrl }}
                  style={styles.resolutionImage}
                />
              </View>
            ) : null}
          </Card>
        )}

        {/* Status History Timeline */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeading}>Status History</Text>
          {issue.statusHistory && issue.statusHistory.length > 0 ? (
            issue.statusHistory.map((history, idx) => (
              <View key={idx} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <View style={styles.timelineStatusRow}>
                    <Badge status={history.status} size="sm" />
                    <Text style={styles.timelineDate}>
                      {new Date(history.updatedAt).toLocaleString()}
                    </Text>
                  </View>
                  {history.note ? (
                    <Text style={styles.timelineNote}>{history.note}</Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.bodyText}>Complaint submitted as Pending.</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  issueImage: {
    width: '100%',
    height: 240,
    backgroundColor: COLORS.surfaceAlt,
  },
  badgesOverlay: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleSection: {
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  reportedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportedByText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  card: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionHeading: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  bodyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  addressText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginLeft: SPACING.xs,
    fontWeight: '500',
    flex: 1,
  },
  coordsText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  resolutionCard: {
    borderColor: COLORS.resolvedBorder,
    backgroundColor: '#f0fdf4',
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  resolutionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.resolved,
    marginLeft: SPACING.xs,
  },
  resolutionNote: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  resolutionImageWrapper: {
    marginTop: SPACING.xs,
  },
  resolutionImageLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  resolutionImage: {
    width: '100%',
    height: 180,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginTop: 6,
    marginRight: SPACING.sm,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  timelineNote: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.danger,
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  retryBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
