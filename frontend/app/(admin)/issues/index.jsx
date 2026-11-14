import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../../components/Header';
import Card from '../../../components/Card';
import Badge from '../../../components/Badge';
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

  const fetchIssues = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'All') params.status = statusFilter;
      if (categoryFilter !== 'All') params.category = categoryFilter;

      const res = await adminService.getAllIssues(params);
      setIssues(res?.data?.issues || []);
    } catch (e) {
      console.warn('Admin issues fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, categoryFilter]);

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

  const renderItem = ({ item }) => (
    <Card
      onPress={() => router.push(`/(admin)/issues/${item._id}`)}
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
          <Text style={styles.desc} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.metaText}>
            Reporter: {item.reportedBy?.name || 'Citizen'}
          </Text>
          <Text style={styles.dateText}>
            Submitted: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Text style={styles.actionPrompt}>Tap to change status / resolve</Text>
        <Ionicons name="create-outline" size={16} color={COLORS.secondary} />
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
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

      {/* Status Chips */}
      <View style={styles.statusChipsRow}>
        {['All', 'Pending', 'In Progress', 'Resolved'].map((st) => {
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
        <Loading message="Loading complaints..." fullScreen />
      ) : (
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
  statusChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
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
    backgroundColor: COLORS.secondaryLight,
    borderColor: COLORS.secondary,
  },
  statusFilterText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  statusFilterTextSelected: {
    color: COLORS.secondary,
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
    width: 75,
    height: 75,
    borderRadius: RADIUS.sm,
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
  desc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  metaText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  dateText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionPrompt: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.secondary,
    fontWeight: '600',
  },
});
