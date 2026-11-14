import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../../components/Header';
import Card from '../../../components/Card';
import Badge from '../../../components/Badge';
import Loading from '../../../components/Loading';
import EmptyState from '../../../components/EmptyState';
import { CATEGORIES, STATUSES } from '../../../constants/categories';
import { issueService } from '../../../services/api';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../constants/theme';

export default function AllIssuesScreen() {
  const router = useRouter();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [error, setError] = useState('');

  const fetchIssues = useCallback(async () => {
    try {
      setError('');
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedStatus !== 'All') params.status = selectedStatus;

      const res = await issueService.getAll(params);
      setIssues(res?.data?.issues || []);
    } catch (err) {
      console.warn('Fetch issues failed:', err);
      setError('Unable to load complaints. Please check server connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCategory, selectedStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIssues();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchIssues]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchIssues();
  };

  const renderIssueItem = ({ item }) => (
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
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.address || 'GPS Coordinates'}
            </Text>
          </View>
          <Text style={styles.dateText}>
            Reported: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
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
        {['All', 'Pending', 'In Progress', 'Resolved'].map((st) => {
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  statusFilterBtn: {
    flex: 1,
    paddingVertical: 6,
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
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  statusFilterTextSelected: {
    color: COLORS.text,
  },
  listContent: {
    padding: SPACING.md,
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
    lineHeight: 16,
    marginBottom: 6,
  },
  metaRow: {
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
