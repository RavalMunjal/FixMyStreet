import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import SupportButton from '../../components/SupportButton';
import EmptyState from '../../components/EmptyState';
import MapPinPickerModal from '../../components/MapPinPickerModal';
import { issueService } from '../../services/api';
import { APP_CONFIG } from '../../constants/config';
import { DISTANCE_FILTERS_KM, normalizeStatusLabel } from '../../constants/categories';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../../constants/theme';

let MapView, Marker, Circle, PROVIDER_GOOGLE;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
} catch (e) {
  console.warn('react-native-maps not available in this environment');
}

const hasValidCoords = (item) =>
  typeof item?.latitude === 'number' &&
  typeof item?.longitude === 'number' &&
  Number.isFinite(item.latitude) &&
  Number.isFinite(item.longitude) &&
  item.latitude >= -90 &&
  item.latitude <= 90 &&
  item.longitude >= -180 &&
  item.longitude <= 180;

export default function NearbyMapScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const mapRef = useRef(null);

  const [issues, setIssues] = useState([]);
  const [radiusKm, setRadiusKm] = useState(3);
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'
  const [searchCenter, setSearchCenter] = useState(null); // { latitude, longitude, isManual }
  const [mapReady, setMapReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');
  const [mapError, setMapError] = useState('');
  const [manualModalVisible, setManualModalVisible] = useState(false);

  const animateCameraTo = (coords, radKm) => {
    if (!mapRef.current || !coords) return;
    const delta = Math.max(0.015, (radKm / 111) * 2.4);
    mapRef.current.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      450
    );
  };

  const fetchNearbyAt = useCallback(async (coords, radKm) => {
    try {
      setMapError('');
      const res = await issueService.getNearby(
        coords.latitude,
        coords.longitude,
        radKm
      );
      const items = res?.data?.issues || [];
      const seen = new Set();
      const valid = [];
      for (const item of items) {
        if (item?._id && !seen.has(item._id) && hasValidCoords(item)) {
          seen.add(item._id);
          valid.push(item);
        }
      }
      setIssues(valid);
      setSelectedIssue((prev) =>
        prev ? valid.find((v) => v._id === prev._id) || null : null
      );
    } catch (err) {
      console.warn('Nearby fetch error:', err);
      setMapError(err.message || 'Unable to load nearby issues from server.');
    }
  }, []);

  const initOrRefreshLocation = useCallback(
    async (radKm = radiusKm, forceGps = false) => {
      try {
        setLoading(true);
        setMapError('');

        // Preserve user's manually chosen search location unless forcing GPS retry
        if (searchCenter?.isManual && !forceGps) {
          await fetchNearbyAt(searchCenter, radKm);
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setHasLocationPermission(true);
          setLocationNotice('');
          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              isManual: false,
            };
            setSearchCenter(coords);
            await fetchNearbyAt(coords, radKm);
            if (mapReady) {
              animateCameraTo(coords, radKm);
            }
            return;
          } catch (locErr) {
            console.warn('GPS fetch error:', locErr);
            setLocationNotice(
              'Unable to get current GPS fix. Retry GPS or pick a search location manually.'
            );
          }
        } else {
          setHasLocationPermission(false);
          setLocationNotice(
            'Location permission denied. Tap "Set Location" or retry GPS permission.'
          );
        }

        if (searchCenter) {
          await fetchNearbyAt(searchCenter, radKm);
        } else {
          setIssues([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [radiusKm, searchCenter, fetchNearbyAt, mapReady]
  );

  useFocusEffect(
    useCallback(() => {
      initOrRefreshLocation(radiusKm, false);
    }, [radiusKm])
  );

  const handleSelectRadius = async (km) => {
    setRadiusKm(km);
    if (searchCenter) {
      setLoading(true);
      await fetchNearbyAt(searchCenter, km);
      setLoading(false);
      if (mapReady) {
        animateCameraTo(searchCenter, km);
      }
    }
  };

  const handleManualLocationPicked = async ({ latitude, longitude }) => {
    const manualCoords = { latitude, longitude, isManual: true };
    setManualModalVisible(false);
    setLocationNotice('Showing nearby complaints around manually selected pin.');
    setSearchCenter(manualCoords);
    setLoading(true);
    await fetchNearbyAt(manualCoords, radiusKm);
    setLoading(false);
    if (mapReady) {
      animateCameraTo(manualCoords, radiusKm);
    }
  };

  const handleIssueUpdated = (updated) => {
    setIssues((prev) =>
      prev.map((i) =>
        i._id === updated._id ? { ...updated, distanceKm: i.distanceKm } : i
      )
    );
    setSelectedIssue((prev) =>
      prev && prev._id === updated._id
        ? { ...updated, distanceKm: prev.distanceKm }
        : prev
    );
  };

  const getMarkerPinColor = (status) => {
    switch (normalizeStatusLabel(status)) {
      case 'Resolved':
        return COLORS.resolved;
      case 'In Progress':
        return COLORS.inProgress;
      case 'Under Review':
        return COLORS.underReview;
      default:
        return COLORS.pending;
    }
  };

  const renderListCard = ({ item }) => (
    <Card
      onPress={() => router.push(`/(citizen)/issues/${item._id}`)}
      style={styles.listCard}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.listBadgeRow}>
          <Badge category={item.category} size="sm" />
          {item.confirmedUrgency === 'High' ? (
            <Badge urgency="High" size="sm" />
          ) : null}
        </View>
        <Badge status={item.status} size="sm" />
      </View>

      <View style={styles.listCardBody}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.listThumb} />
        ) : null}
        <View style={styles.listInfoCol}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.distanceText}>
            <Ionicons name="navigate-outline" size={12} color={COLORS.primary} />{' '}
            {typeof item.distanceKm === 'number'
              ? `${item.distanceKm.toFixed(2)} km away`
              : 'Nearby'}
          </Text>
          <Text style={styles.listAddress} numberOfLines={1}>
            {item.address || `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`}
          </Text>
        </View>
      </View>

      <View style={styles.listCardFooter}>
        <SupportButton
          issue={item}
          currentUserId={user?._id}
          onUpdated={handleIssueUpdated}
          compact
        />
        <Text style={styles.detailsText}>Details →</Text>
      </View>
    </Card>
  );

  const initialRegion = searchCenter
    ? {
        latitude: searchCenter.latitude,
        longitude: searchCenter.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }
    : APP_CONFIG.defaultLocation;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        title="Nearby Issues"
        subtitle={
          searchCenter
            ? `${issues.length} reports within ${radiusKm} km`
            : 'Location needed to measure distances'
        }
        rightComponent={
          <View style={styles.viewToggle}>
            <TouchableOpacity
              onPress={() => setViewMode('map')}
              style={[
                styles.viewToggleBtn,
                viewMode === 'map' && styles.viewToggleActive,
              ]}
            >
              <Ionicons
                name="map"
                size={16}
                color={viewMode === 'map' ? '#ffffff' : COLORS.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('list')}
              style={[
                styles.viewToggleBtn,
                viewMode === 'list' && styles.viewToggleActive,
              ]}
            >
              <Ionicons
                name="list"
                size={16}
                color={viewMode === 'list' ? '#ffffff' : COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Distance Filters & Location Actions Bar */}
      <View style={styles.filterBar}>
        <View style={styles.distanceRow}>
          {DISTANCE_FILTERS_KM.map((km) => {
            const active = radiusKm === km;
            return (
              <TouchableOpacity
                key={km}
                onPress={() => handleSelectRadius(km)}
                style={[styles.radiusChip, active && styles.radiusChipActive]}
              >
                <Text
                  style={[
                    styles.radiusChipText,
                    active && styles.radiusChipTextActive,
                  ]}
                >
                  {km} km
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.locButtonsRow}>
          <TouchableOpacity
            onPress={() => initOrRefreshLocation(radiusKm, true)}
            style={styles.smallLocBtn}
          >
            <Ionicons name="locate" size={14} color={COLORS.primary} />
            <Text style={styles.smallLocBtnText}>GPS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setManualModalVisible(true)}
            style={[styles.smallLocBtn, { backgroundColor: COLORS.secondaryLight }]}
          >
            <Ionicons name="pin" size={14} color={COLORS.secondary} />
            <Text style={[styles.smallLocBtnText, { color: COLORS.secondary }]}>
              Set Location
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Permission / Error Banner */}
      {(locationNotice || mapError) ? (
        <View style={styles.bannerNotice}>
          <Ionicons
            name={mapError ? 'alert-circle-outline' : 'location-outline'}
            size={16}
            color={mapError ? COLORS.danger : COLORS.pending}
          />
          <Text style={styles.bannerNoticeText}>
            {mapError || locationNotice}
          </Text>
        </View>
      ) : null}

      {/* Main Content: Map OR List */}
      {!searchCenter && !loading ? (
        <EmptyState
          icon="location-outline"
          title="Location Needed"
          description="Allow GPS permission or pick a location manually on the map to find street issues within 1, 3, or 5 km."
          actionLabel="Pick Location on Map"
          onAction={() => setManualModalVisible(true)}
        />
      ) : viewMode === 'list' ? (
        <FlatList
          data={issues}
          keyExtractor={(item) => item._id}
          renderItem={renderListCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                initOrRefreshLocation(radiusKm, false);
              }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="checkmark-circle-outline"
                title={`No Issues Within ${radiusKm} km`}
                description="Try expanding your distance filter to 5 km or picking another search location."
                actionLabel={radiusKm < 5 ? 'Expand to 5 km' : 'Change Location'}
                onAction={() =>
                  radiusKm < 5
                    ? handleSelectRadius(5)
                    : setManualModalVisible(true)
                }
              />
            ) : null
          }
        />
      ) : (
        <View style={styles.mapContainer}>
          {MapView ? (
            <MapView
              ref={mapRef}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={styles.map}
              initialRegion={initialRegion}
              showsUserLocation={hasLocationPermission && !searchCenter?.isManual}
              showsMyLocationButton={false}
              onMapReady={() => {
                setMapReady(true);
                if (searchCenter) {
                  animateCameraTo(searchCenter, radiusKm);
                }
              }}
              onPress={() => setSelectedIssue(null)}
            >
              {searchCenter && Circle ? (
                <Circle
                  center={searchCenter}
                  radius={radiusKm * 1000}
                  strokeColor="rgba(13, 148, 136, 0.55)"
                  fillColor="rgba(13, 148, 136, 0.1)"
                />
              ) : null}

              {searchCenter?.isManual ? (
                <Marker
                  coordinate={searchCenter}
                  pinColor={COLORS.secondary}
                  title="Search Center"
                />
              ) : null}

              {issues.map((issue) => (
                <Marker
                  key={`${issue._id}_${issue.status}`}
                  coordinate={{
                    latitude: issue.latitude,
                    longitude: issue.longitude,
                  }}
                  title={issue.title}
                  description={`${issue.category} • ${issue.distanceKm ?? ''} km`}
                  pinColor={getMarkerPinColor(issue.status)}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedIssue(issue);
                  }}
                />
              ))}
            </MapView>
          ) : (
            <View style={styles.fallbackBox}>
              <Ionicons name="map-outline" size={44} color={COLORS.primary} />
              <Text style={styles.fallbackTitle}>Map View Unavailable</Text>
              <Text style={styles.fallbackText}>
                Switch to List View above to inspect nearby complaints and distances.
              </Text>
            </View>
          )}

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.pending }]} />
              <Text style={styles.legendText}>Reported</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.underReview }]} />
              <Text style={styles.legendText}>Review</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.inProgress }]} />
              <Text style={styles.legendText}>Progress</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.resolved }]} />
              <Text style={styles.legendText}>Resolved</Text>
            </View>
          </View>

          {/* Selected Issue Preview Card */}
          {selectedIssue ? (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={styles.previewBadges}>
                  <Badge category={selectedIssue.category} size="sm" />
                  <Badge status={selectedIssue.status} size="sm" />
                  {selectedIssue.confirmedUrgency === 'High' ? (
                    <Badge urgency="High" size="sm" />
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedIssue(null)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.previewContent}>
                {selectedIssue.imageUrl ? (
                  <Image
                    source={{ uri: selectedIssue.imageUrl }}
                    style={styles.previewThumb}
                  />
                ) : null}
                <View style={styles.previewDetails}>
                  <Text style={styles.previewTitle} numberOfLines={1}>
                    {selectedIssue.title}
                  </Text>
                  <Text style={styles.distanceText}>
                    {typeof selectedIssue.distanceKm === 'number'
                      ? `${selectedIssue.distanceKm.toFixed(2)} km away`
                      : 'Nearby'}
                  </Text>
                  <Text style={styles.previewAddress} numberOfLines={1}>
                    {selectedIssue.address || 'GPS Coordinates'}
                  </Text>
                </View>
              </View>

              <View style={styles.previewFooter}>
                <SupportButton
                  issue={selectedIssue}
                  currentUserId={user?._id}
                  onUpdated={handleIssueUpdated}
                  compact
                />
                <TouchableOpacity
                  style={styles.viewDetailsBtn}
                  onPress={() =>
                    router.push(`/(citizen)/issues/${selectedIssue._id}`)
                  }
                >
                  <Text style={styles.viewDetailsText}>Details</Text>
                  <Ionicons name="arrow-forward" size={14} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Finding issues within {radiusKm} km...</Text>
            </View>
          ) : null}
        </View>
      )}

      <MapPinPickerModal
        visible={manualModalVisible}
        initialCoords={searchCenter}
        onClose={() => setManualModalVisible(false)}
        onConfirm={handleManualLocationPicked}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: 3,
    gap: 3,
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  viewToggleActive: {
    backgroundColor: COLORS.primary,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  distanceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  radiusChip: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  radiusChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  radiusChipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  radiusChipTextActive: {
    color: '#ffffff',
  },
  locButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  smallLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  smallLocBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  bannerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bannerNoticeText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  legend: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    ...SHADOW.card,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  previewCard: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.elevated,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  previewBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  closeBtn: {
    padding: 2,
  },
  previewContent: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  previewThumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
    marginRight: SPACING.sm,
  },
  previewDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  distanceText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
    marginVertical: 2,
  },
  previewAddress: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewDetailsBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  viewDetailsText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  listCard: {
    padding: SPACING.md,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  listBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  listCardBody: {
    flexDirection: 'row',
  },
  listThumb: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
    marginRight: SPACING.md,
  },
  listInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  listTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  listAddress: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  listCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailsText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  fallbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  fallbackTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  fallbackText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: SPACING.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
    ...SHADOW.card,
  },
  loadingText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontWeight: '500',
  },
});
