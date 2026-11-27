import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { adminService } from '../../services/api';
import IssueCard from '../../components/IssueCard';
import NotificationBell from '../../components/NotificationBell';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotifications();

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    highUrgency: 0,
    totalUsers: 0,
  });
  const [recentIssues, setRecentIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      setError('');
      const res = await adminService.getDashboard();
      if (res?.data?.stats) {
        setStats(res.data.stats);
      }
      if (res?.data?.recentIssues) {
        setRecentIssues(res.data.recentIssues);
      }
    } catch (err) {
      console.warn('Admin dashboard fetch error:', err);
      setError(err.message || 'Unable to load admin metrics. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
      refreshUnreadCount();
    }, [fetchDashboard, refreshUnreadCount])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const renderRecentIssues = () => {
    if (error) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (recentIssues.length === 0) {
      return (
        <EmptyState
          icon="checkmark-done-circle-outline"
          title="No Issues Reported"
          description="The complaint database is currently clear."
        />
      );
    }

    return recentIssues.map((issue) => (
      <IssueCard
        key={issue._id}
        issue={issue}
        onPress={() => router.push(`/(admin)/issues/${issue._id}`)}
        showRequestedUrgency
        showReporter
      />
    ));
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Loading message="Loading Administrator Control Center..." fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.secondary]}
          />
        }
      >
        {/* Admin Header */}
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.secondary} />
              <Text style={styles.adminBadgeText}>Administrator Portal</Text>
            </View>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || 'Admin'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell />
            <TouchableOpacity
              style={styles.profileBadge}
              onPress={() => router.push('/(admin)/profile')}
            >
              <Ionicons name="settings-outline" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Real MongoDB Database Metrics Grid */}
        <Text style={styles.sectionTitle}>Municipal Issue Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { borderLeftColor: COLORS.secondary }]}>
            <Text style={styles.metricCount}>{stats.total}</Text>
            <Text style={styles.metricLabel}>Total Filed</Text>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: COLORS.pending }]}>
            <Text style={[styles.metricCount, { color: COLORS.pending }]}>
              {stats.pending}
            </Text>
            <Text style={styles.metricLabel}>Reported / Review</Text>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: COLORS.inProgress }]}>
            <Text style={[styles.metricCount, { color: COLORS.inProgress }]}>
              {stats.inProgress}
            </Text>
            <Text style={styles.metricLabel}>In Progress</Text>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: COLORS.resolved }]}>
            <Text style={[styles.metricCount, { color: COLORS.resolved }]}>
              {stats.resolved}
            </Text>
            <Text style={styles.metricLabel}>Resolved</Text>
          </View>
        </View>

        {/* Confirmed High Urgency Callout */}
        <TouchableOpacity
          style={styles.urgencyBanner}
          onPress={() => router.push('/(admin)/issues')}
        >
          <View style={styles.urgencyLeft}>
            <Ionicons name="alert-circle" size={22} color={COLORS.danger} />
            <View style={styles.urgencyTextCol}>
              <Text style={styles.urgencyTitle}>
                Confirmed High Urgency: {stats.highUrgency || 0}
              </Text>
              <Text style={styles.urgencySubtitle}>
                Tap to review & prioritize civic complaints
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.danger} />
        </TouchableOpacity>

        {/* Quick Management Navigation Cards */}
        <View style={styles.quickNavRow}>
          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={() => router.push('/(admin)/issues')}
          >
            <Ionicons name="construct" size={24} color={COLORS.secondary} />
            <Text style={styles.quickNavTitle}>Review Complaints</Text>
            <Text style={styles.quickNavSubtitle}>
              Update timeline, urgency & proof
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={() => router.push('/(admin)/users')}
          >
            <Ionicons name="people" size={24} color={COLORS.primary} />
            <Text style={styles.quickNavTitle}>Citizen Directory</Text>
            <Text style={styles.quickNavSubtitle}>
              {stats.totalUsers || 0} registered citizens
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Submissions */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Latest Submissions</Text>
          <TouchableOpacity onPress={() => router.push('/(admin)/issues')}>
            <Text style={styles.seeAllText}>Manage All</Text>
          </TouchableOpacity>
        </View>

        {renderRecentIssues()}
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
    paddingBottom: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerTextCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  adminBadgeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.secondary,
    fontWeight: '700',
    marginLeft: 4,
  },
  userName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    padding: SPACING.md,
  },
  metricCount: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
  },
  metricLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  urgencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  urgencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  urgencyTextCol: {
    flex: 1,
  },
  urgencyTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.danger,
  },
  urgencySubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  quickNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  quickNavCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  quickNavTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  quickNavSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  seeAllText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  errorBox: {
    padding: SPACING.md,
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
  },
});
