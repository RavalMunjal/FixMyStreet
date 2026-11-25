import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import { issueService } from '../../services/api';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';

export default function MyComplaintsScreen() {
  const router = useRouter();

  const [myIssues, setMyIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchMyComplaints = useCallback(async () => {
    try {
      setError('');
      const res = await issueService.getMy();
      setMyIssues(res?.data?.issues || []);
    } catch (err) {
      console.warn('Failed to load my issues:', err);
      setError(err.message || 'Unable to load your complaints. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMyComplaints();
    }, [fetchMyComplaints])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyComplaints();
  };

  const renderItem = ({ item }) => (
    <Card
      onPress={() => router.push(`/(citizen)/issues/${item._id}`)}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <Badge category={item.category} size="sm" />
        <Badge status={item.status} size="sm" />
      </View>

      <View style={styles.cardBody}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
        ) : null}
        <View style={styles.contentCol}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.address || 'GPS Coordinates'}
            </Text>
          </View>
          <Text style={styles.dateText}>
            Filed on: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {item.adminNote ? (
        <View style={styles.adminNoteBox}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.primary} />
          <Text style={styles.adminNoteText} numberOfLines={1}>
            Admin: {item.adminNote}
          </Text>
        </View>
      ) : null}
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        title="My Complaints"
        subtitle={`${myIssues.length} issues reported by you`}
      />

      {loading && !refreshing ? (
        <Loading message="Fetching your complaints history..." fullScreen />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchMyComplaints} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={myIssues}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="You Haven't Reported Any Issues"
              description="Notice a pothole, broken streetlight, or garbage? File your first complaint today."
              actionLabel="Report an Issue"
              onAction={() => router.push('/(citizen)/report')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  card: {
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
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    marginRight: SPACING.md,
  },
  contentCol: {
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
    marginBottom: 2,
  },
  locationText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  dateText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  adminNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    marginTop: SPACING.sm,
  },
  adminNoteText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    marginLeft: SPACING.xs,
    fontWeight: '500',
    flex: 1,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
