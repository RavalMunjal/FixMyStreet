import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../components/Header';
import IssueCard from '../../../components/IssueCard';
import Loading from '../../../components/Loading';
import EmptyState from '../../../components/EmptyState';
import { CATEGORIES } from '../../../constants/categories';
import { issueService } from '../../../services/api';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../constants/theme';

export default function AllIssuesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'most_supported'
  const [error, setError] = useState('');

  const fetchIssues = useCallback(async () => {
    try {
      setError('');
      const params = { sort: sortBy };
      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedStatus !== 'All') params.status = selectedStatus;

      const res = await issueService.getAll(params);
      setIssues(res?.data?.issues || []);
    } catch (err) {
      console.warn('Fetch issues failed:', err);
      setError(err.message || 'Unable to load complaints. Please check server connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCategory, selectedStatus, sortBy]);

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

  const handleIssueUpdated = (updatedIssue) => {
    setIssues((prev) =>
      prev.map((item) => (item._id === updatedIssue._id ? updatedIssue : item))
    );
  };

  const renderIssueItem = ({ item }) => (
    <IssueCard
      issue={item}
      onPress={() => router.push(`/(citizen)/issues/${item._id}`)}
      showSupportButton
      currentUserId={user?._id}
      onIssueUpdated={handleIssueUpdated}
      datePrefix="Reported: "
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        title="All Street Issues"
        subtitle="Community civic complaints board"
        rightComponent={
          <TouchableOpacity onPress={() => router.push('/(citizen)/map')}>
            <Ionicons name="map-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          placeholder="Search by title, landmark, or description..."
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
            const isSelected = selectedCategory === item.id;
            return (
              <TouchableOpacity
                onPress={() => setSelectedCategory(item.id)}
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

      {/* Status Filter Chips */}
      <View style={styles.statusChipsRow}>
        {['All', 'Reported', 'Under Review', 'In Progress', 'Resolved'].map((st) => {
          const isSelected = selectedStatus === st;
          return (
            <TouchableOpacity
              key={st}
              onPress={() => setSelectedStatus(st)}
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

      {/* Sort Row */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity
          onPress={() => setSortBy('newest')}
          style={[styles.sortPill, sortBy === 'newest' && styles.sortPillActive]}
        >
          <Text
            style={[
              styles.sortPillText,
              sortBy === 'newest' && styles.sortPillTextActive,
            ]}
          >
            Newest
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortBy('most_supported')}
          style={[
            styles.sortPill,
            sortBy === 'most_supported' && styles.sortPillActive,
          ]}
        >
          <Ionicons
            name="thumbs-up-outline"
            size={12}
            color={sortBy === 'most_supported' ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.sortPillText,
              sortBy === 'most_supported' && styles.sortPillTextActive,
            ]}
          >
            Most Supported
          </Text>
        </TouchableOpacity>
      </View>

      {/* Issues List */}
      {loading && !refreshing ? (
        <Loading message="Fetching complaints..." fullScreen />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchIssues} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={issues}
          keyExtractor={(item) => item._id}
          renderItem={renderIssueItem}
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
              icon="search-outline"
              title="No Issues Match Your Filters"
              description="Try clearing your search query or selecting a different category."
              actionLabel="Reset Filters"
              onAction={() => {
                setSearch('');
                setSelectedCategory('All');
                setSelectedStatus('All');
                setSortBy('newest');
              }}
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
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
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
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  statusFilterBtnSelected: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.text,
  },
  statusFilterText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  statusFilterTextSelected: {
    color: COLORS.text,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  sortLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  sortPillText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sortPillTextActive: {
    color: COLORS.primaryDark,
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
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
