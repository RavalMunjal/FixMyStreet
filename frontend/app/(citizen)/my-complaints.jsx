import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Header from '../../components/Header';
import IssueCard from '../../components/IssueCard';
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
    <IssueCard
      issue={item}
      onPress={() => router.push(`/(citizen)/issues/${item._id}`)}
      datePrefix="Filed on: "
      showAdminNote
    />
  );

  const renderBody = () => {
    if (loading && !refreshing) {
      return <Loading message="Fetching your complaints history..." fullScreen />;
    }

    if (error) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchMyComplaints} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
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
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        title="My Complaints"
        subtitle={`${myIssues.length} issues reported by you`}
      />
      {renderBody()}
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
