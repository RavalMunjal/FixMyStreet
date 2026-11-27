import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../../components/Header';
import IssueCard from '../../../components/IssueCard';
import Loading from '../../../components/Loading';
import EmptyState from '../../../components/EmptyState';
import { CATEGORIES } from '../../../constants/categories';
import { adminService } from '../../../services/api';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../constants/theme';

export default function AdminIssuesScreen() {
  const router = useRouter();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [urgencyFilter, setUrgencyFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'urgency' | 'most_supported'
  const [error, setError] = useState('');

  const fetchIssues = useCallback(async () => {
    try {
      setError('');
      const params = { sort: sortBy };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'All') params.status = statusFilter;
      if (categoryFilter !== 'All') params.category = categoryFilter;
      if (urgencyFilter !== 'All') params.confirmedUrgency = urgencyFilter;

      const res = await adminService.getAllIssues(params);
      setIssues(res?.data?.issues || []);
    } catch (e) {
      console.warn('Admin issues fetch error:', e);
      setError(e.message || 'Unable to load complaints. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, categoryFilter, urgencyFilter, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIssues();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchIssues]);

  useFocusEffect(
    useCallback(() => {
      fetchIssues();
    }, [fetchIssues])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchIssues();
  };

  const renderItem = ({ item }) => (
    <IssueCard
      issue={item}
      onPress={() => router.push(`/(admin)/issues/${item._id}`)}
      showRequestedUrgency
      showReporter
      datePrefix="Submitted: "
      footerPrompt="Tap to update timeline / urgency / resolve"
    />
  );

  const renderIssuesBody = () => {
    if (loading && !refreshing) {
      return <Loading message="Loading complaints..." fullScreen />;
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchIssues} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={issues}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.secondary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="No Complaints Found"
            description="No issues match the selected filter criteria."
            actionLabel="Clear Filters"
            onAction={() => {
              setSearch('');
              setStatusFilter('All');
              setCategoryFilter('All');
              setUrgencyFilter('All');
              setSortBy('newest');
            }}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        title="Manage Complaints"
        subtitle={`${issues.length} complaints matching filters`}
      />

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          placeholder="Filter by title, address, description..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category Filter Chips */}
      <View style={styles.filtersWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'All', label: 'All Categories' }, ...CATEGORIES]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chipsScroll}
          renderItem={({ item }) => {
            const isSelected = categoryFilter === item.id;
            return (
              <TouchableOpacity
                onPress={() => setCategoryFilter(item.id)}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                <Text
                  style={[styles.chipText, isSelected && styles.chipTextSelected]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Status Chips */}
      <View style={styles.statusChipsRow}>
        {['All', 'Reported', 'Under Review', 'In Progress', 'Resolved'].map((st) => {
          const isSelected = statusFilter === st;
          return (
            <TouchableOpacity
              key={st}
              onPress={() => setStatusFilter(st)}
              style={[
                styles.statusFilterBtn,
                isSelected && styles.statusFilterBtnSelected,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.statusFilterText,
                  isSelected && styles.statusFilterTextSelected,
                ]}
              >
                {st}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Urgency Filter & Sort Bar */}
      <View style={styles.sortUrgencyRow}>
        <TouchableOpacity
          onPress={() =>
            setUrgencyFilter((prev) => (prev === 'High' ? 'All' : 'High'))
          }
          style={[
            styles.urgencyFilterPill,
            urgencyFilter === 'High' && styles.urgencyFilterPillActive,
          ]}
        >
          <Ionicons
            name="alert-circle-outline"
            size={13}
            color={urgencyFilter === 'High' ? '#ffffff' : COLORS.danger}
          />
          <Text
            style={[
              styles.urgencyFilterText,
              urgencyFilter === 'High' && { color: '#ffffff' },
            ]}
          >
            {urgencyFilter === 'High' ? 'High Urgency Only' : 'Filter: High Urgency'}
          </Text>
        </TouchableOpacity>

        <View style={styles.sortPillsRow}>
          {[
            { id: 'newest', label: 'Newest' },
            { id: 'urgency', label: 'By Urgency' },
            { id: 'most_supported', label: 'Top Support' },
          ].map((s) => {
            const active = sortBy === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSortBy(s.id)}
                style={[styles.sortChip, active && styles.sortChipActive]}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    active && styles.sortChipTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Issues List */}
      {renderIssuesBody()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  filtersWrapper: {
    marginTop: SPACING.xs,
  },
  chipsScroll: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  chipText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  statusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  statusFilterBtn: {
    flexGrow: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  statusFilterBtnSelected: {
    backgroundColor: COLORS.secondaryLight,
    borderColor: COLORS.secondary,
  },
  statusFilterText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  statusFilterTextSelected: {
    color: COLORS.secondary,
  },
  sortUrgencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  urgencyFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  urgencyFilterPillActive: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  urgencyFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.danger,
  },
  sortPillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  sortChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortChipActive: {
    backgroundColor: COLORS.secondaryLight,
    borderColor: COLORS.secondary,
  },
  sortChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: COLORS.secondary,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  errorContainer: {
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
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
