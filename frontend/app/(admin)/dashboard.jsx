import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/api';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
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
      setError('Unable to load admin metrics. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
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
          <TouchableOpacity
            style={styles.profileBadge}
            onPress={() => router.push('/(admin)/profile')}
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.secondary} />
          </TouchableOpacity>
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
            <Text style={styles.metricLabel}>Action Pending</Text>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: COLORS.inProgress }]}>
            <Text style={[styles.metricCount, { color: COLORS.inProgress }]}>
              {stats.inProgress}
            </Text>
            <Text style={styles.metricLabel}>In Repair</Text>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: COLORS.resolved }]}>
            <Text style={[styles.metricCount, { color: COLORS.resolved }]}>
              {stats.resolved}
            </Text>
            <Text style={styles.metricLabel}>Resolved</Text>
          </View>
        </View>

        {/* Quick Management Navigation Cards */}
        <View style={styles.quickNavRow}>
          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={() => router.push('/(admin)/issues')}
          >
            <Ionicons name="construct" size={24} color={COLORS.secondary} />
            <Text style={styles.quickNavTitle}>Review Complaints</Text>
            <Text style={styles.quickNavSubtitle}>
              Update status, notes & proof
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

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : recentIssues.length === 0 ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="No Issues Reported"
            description="The complaint database is currently clear."
          />
        ) : (
          recentIssues.map((issue) => (
            <Card
              key={issue._id}
              onPress={() => router.push(`/(admin)/issues/${issue._id}`)}
              style={styles.issueCard}
            >
              <View style={styles.cardHeader}>
                <Badge category={issue.category} size="sm" />
                <Badge status={issue.status} size="sm" />
              </View>

              <View style={styles.cardBody}>
                {issue.imageUrl ? (
                  <Image source={{ uri: issue.imageUrl }} style={styles.thumb} />
                ) : null}
                <View style={styles.issueInfo}>
                  <Text style={styles.issueTitle} numberOfLines={1}>
                    {issue.title}
                  </Text>
                  <Text style={styles.issueDesc} numberOfLines={2}>
                    {issue.description}
                  </Text>
                  <Text style={styles.reporterText}>
                    By: {issue.reportedBy?.name || 'Citizen'} •{' '}
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
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
    marginBottom: SPACING.lg,
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
  quickNavRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  quickNavCard: {
    flex: 1,
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
  issueCard: {
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  cardBody: {
    flexDirection: 'row',
  },
  thumb: {
    width: 70,
    height: 70,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
    marginRight: SPACING.md,
  },
  issueInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  issueTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  issueDesc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  reporterText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
});
