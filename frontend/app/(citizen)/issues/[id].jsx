import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../components/Header';
import Badge from '../../../components/Badge';
import Card from '../../../components/Card';
import SupportButton from '../../../components/SupportButton';
import StatusTimeline from '../../../components/StatusTimeline';
import Loading from '../../../components/Loading';
import { issueService } from '../../../services/api';
import { isValidCoordinate, openGoogleMapsDirections } from '../../../services/location';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../constants/theme';

let MapView, Marker, PROVIDER_GOOGLE;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
} catch (e) {
  console.warn('react-native-maps unavailable');
}

export default function IssueDetailsScreen() {
  const { id } = useLocalSearchParams();
  const issueId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { user } = useAuth();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDetails = useCallback(async () => {
    if (!issueId) {
      setIssue(null);
      setError('Complaint not found or has been deleted.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError('');
      const res = await issueService.getById(issueId);
      const data = res?.data?.issue;
      if (!data) {
        setIssue(null);
        setError('Complaint not found or has been deleted.');
        return;
      }
      setIssue(data);
    } catch (err) {
      console.warn('Error fetching issue details:', err);
      setIssue(null);
      setError(err.message || 'Complaint not found or has been deleted.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [issueId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchDetails();
    }, [fetchDetails])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDetails();
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header title="Complaint Details" showBack />
        <Loading message="Loading complaint details..." fullScreen />
      </SafeAreaView>
    );
  }

  if (error || !issue) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header title="Complaint Details" showBack />
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>
            {error || 'Complaint not found or has been removed.'}
          </Text>
          <View style={styles.errorActionsRow}>
            <TouchableOpacity
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace('/(citizen)/issues')
              }
              style={[styles.retryBtn, styles.backOutlineBtn]}
            >
              <Text style={styles.backOutlineText}>Go Back</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={fetchDetails} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const hasValidCoords = isValidCoordinate(
    Number(issue.latitude),
    Number(issue.longitude)
  );

  const renderUrgencyBadge = () => {
    if (issue.confirmedUrgency === 'High') {
      return <Badge urgency="High" size="sm" label="Confirmed High Urgency" />;
    }
    if (issue.requestedUrgency === 'High') {
      return (
        <Badge urgency="High" size="sm" label="Requested: High (Pending Review)" />
      );
    }
    return <Badge urgency="Normal" size="sm" />;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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

        {/* Title, Metadata & Support Button */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{issue.title}</Text>
          <View style={styles.reportedByRow}>
            <Ionicons name="person-circle-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.reportedByText}>
              Reported by {issue.reportedBy?.name || 'Citizen'} on{' '}
              {new Date(issue.createdAt).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.urgencySupportRow}>
            <SupportButton
              issue={issue}
              currentUserId={user?._id}
              onUpdated={(updated) => setIssue(updated)}
            />
            <View style={styles.urgencyPills}>{renderUrgencyBadge()}</View>
          </View>
        </View>

        {/* Description Card */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeading}>Description</Text>
          <Text style={styles.bodyText}>{issue.description}</Text>
        </Card>

        {/* Location Card + Embedded Pin Map */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeading}>Location & Map Pin</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.addressText}>
              {issue.address || 'Location captured via GPS'}
            </Text>
          </View>
          {hasValidCoords ? (
            <>
              <Text style={styles.coordsText}>
                GPS Coordinates: {issue.latitude.toFixed(5)}, {issue.longitude.toFixed(5)}
              </Text>
              {MapView ? (
                <View style={styles.miniMapWrapper}>
                  <MapView
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    style={styles.miniMap}
                    initialRegion={{
                      latitude: Number(issue.latitude),
                      longitude: Number(issue.longitude),
                      latitudeDelta: 0.008,
                      longitudeDelta: 0.008,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: Number(issue.latitude),
                        longitude: Number(issue.longitude),
                      }}
                      title={issue.title}
                      description={issue.address || issue.category}
                    />
                  </MapView>
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.directionsBtn}
                onPress={() =>
                  openGoogleMapsDirections(issue.latitude, issue.longitude)
                }
              >
                <Ionicons name="navigate-outline" size={18} color="#ffffff" />
                <Text style={styles.directionsBtnText}>Get Directions in Google Maps</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </Card>

        {/* Admin Resolution Section if available */}
        {(issue.adminNote || issue.resolutionImageUrl) && (
          <Card style={[styles.card, styles.resolutionCard]}>
            <View style={styles.resolutionHeader}>
              <Ionicons name="shield-checkmark" size={22} color={COLORS.resolved} />
              <Text style={styles.resolutionTitle}>Administrator Update</Text>
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

        {/* Feature 2: Visual 4-Step Progress Timeline */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeading}>Complaint Progress Timeline</Text>
          <StatusTimeline
            statusHistory={issue.statusHistory}
            currentStatus={issue.status}
          />
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
    paddingBottom: SPACING.xl,
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
    flexWrap: 'wrap',
    gap: SPACING.xs,
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
    marginBottom: SPACING.sm,
  },
  reportedByText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  urgencySupportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  urgencyPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  miniMapWrapper: {
    height: 160,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniMap: {
    width: '100%',
    height: '100%',
  },
  directionsBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  directionsBtnText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
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
  errorActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
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
  backOutlineBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backOutlineText: {
    color: COLORS.text,
    fontWeight: '700',
  },
});
