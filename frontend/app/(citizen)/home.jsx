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
import { issueService } from '../../services/api';
import Button from '../../components/Button';
import IssueCard from '../../components/IssueCard';
import NotificationBell from '../../components/NotificationBell';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';

export default function HomeDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotifications();

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [recentIssues, setRecentIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      setError('');
      const res = await issueService.getAll({ limit: 5 });
      const issues = res?.data?.issues || [];
      const apiStats = res?.data?.stats;

      if (apiStats) {
        setStats({
          total: apiStats.total ?? 0,
          pending: apiStats.pending ?? 0,
          inProgress: apiStats.inProgress ?? 0,
          resolved: apiStats.resolved ?? 0,
        });
      } else {
        setStats({
          total: res?.data?.total || issues.length,
          pending: issues.filter(
            (i) => i.status === 'Reported' || i.status === 'Under Review' || i.status === 'Pending'
          ).length,
          inProgress: issues.filter((i) => i.status === 'In Progress').length,
          resolved: issues.filter((i) => i.status === 'Resolved').length,
        });
      }

      setRecentIssues(issues);
    } catch (err) {
      console.warn('Dashboard fetch error:', err.message);
      setError(err.message || 'Unable to load latest complaints. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
      refreshUnreadCount();
    }, [fetchDashboardData, refreshUnreadCount])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleIssueUpdated = (updatedIssue) => {
    setRecentIssues((prev) =>
      prev.map((item) => (item._id === updatedIssue._id ? updatedIssue : item))
    );
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
          icon="construct-outline"
          title="No Complaints Yet"
          description="Your local area has no reported issues right now. Be the first to report!"
          actionLabel="Report an Issue"
          onAction={() => router.push('/(citizen)/report')}
        />
      );
    }

    return recentIssues.map((issue) => (
      <IssueCard
        key={issue._id}
        issue={issue}
        onPress={() => router.push(`/(citizen)/issues/${issue._id}`)}
        showSupportButton
        currentUserId={user?._id}
        onIssueUpdated={handleIssueUpdated}
      />
    ));
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Loading message="Loading FixMyStreet dashboard..." fullScreen />
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
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Welcome Header */}
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || 'Citizen'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell />
            <TouchableOpacity
              style={styles.profileBadge}
              onPress={() => router.push('/(citizen)/profile')}
            >
              <Ionicons name="person" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Action Banner */}
        <View style={styles.actionBanner}>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Spotted a civic problem?</Text>
            <Text style={styles.actionSubtitle}>
              Pothole, broken streetlight, or garbage? Report it with photo & GPS.
            </Text>
            <Button
              title="Report Issue Now"
              onPress={() => router.push('/(citizen)/report')}
              icon="camera-outline"
              style={styles.bannerBtn}
            />
          </View>
        </View>

        {/* Statistics Grid */}
        <Text style={styles.sectionTitle}>Complaints Overview</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { borderColor: COLORS.border }]}>
            <Text style={styles.statCount}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Issues</Text>
          </View>

          <View style={[styles.statBox, { borderColor: COLORS.pendingBorder }]}>
            <Text style={[styles.statCount, { color: COLORS.pending }]}>
              {stats.pending}
            </Text>
            <Text style={styles.statLabel}>Reported / Review</Text>
          </View>

          <View
            style={[styles.statBox, { borderColor: COLORS.inProgressBorder }]}
          >
            <Text style={[styles.statCount, { color: COLORS.inProgress }]}>
              {stats.inProgress}
            </Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>

          <View style={[styles.statBox, { borderColor: COLORS.resolvedBorder }]}>
            <Text style={[styles.statCount, { color: COLORS.resolved }]}>
              {stats.resolved}
            </Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        {/* Shortcuts */}
        <View style={styles.shortcutsRow}>
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(citizen)/map')}
          >
            <View style={[styles.shortcutIcon, { backgroundColor: COLORS.secondaryLight }]}>
              <Ionicons name="map" size={22} color={COLORS.secondary} />
            </View>
            <View style={styles.shortcutTextCol}>
              <Text style={styles.shortcutTitle}>Nearby Issues (1/3/5 km)</Text>
              <Text style={styles.shortcutSubtitle}>Explore & filter nearby problems</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(citizen)/my-complaints')}
          >
            <View style={[styles.shortcutIcon, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="folder-open" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.shortcutTextCol}>
              <Text style={styles.shortcutTitle}>My Complaints</Text>
              <Text style={styles.shortcutSubtitle}>Track timeline & status updates</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent Complaints Section */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Street Reports</Text>
          <TouchableOpacity onPress={() => router.push('/(citizen)/issues')}>
            <Text style={styles.seeAllText}>See All</Text>
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
  greeting: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
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
  actionBanner: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  actionContent: {
    width: '100%',
  },
  actionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: SPACING.xs,
  },
  actionSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: '#ccfbf1',
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  bannerBtn: {
    backgroundColor: COLORS.primary,
    height: 44,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statCount: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  shortcutsRow: {
    flexDirection: 'column',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  shortcutTextCol: {
    flex: 1,
  },
  shortcutTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  shortcutSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
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
    color: COLORS.primary,
  },
  errorBox: {
    padding: SPACING.md,
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.danger,
    textAlign: 'center',
  },
});
