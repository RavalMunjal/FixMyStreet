import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import Badge from '../../components/Badge';
import IssueCard from '../../components/IssueCard';
import SupportButton from '../../components/SupportButton';
import EmptyState from '../../components/EmptyState';
import MapPinPickerModal from '../../components/MapPinPickerModal';
import { issueService } from '../../services/api';
import {
  getCurrentGpsPosition,
  isValidCoordinate,
  openGoogleMapsDirections,
} from '../../services/location';
import { APP_CONFIG } from '../../constants/config';
import { DISTANCE_FILTERS_KM, normalizeStatusLabel } from '../../constants/categories';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../../constants/theme';

let MapView = null;
let Marker = null;
let Circle = null;
let PROVIDER_GOOGLE;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps;
    Marker = Maps.Marker;
    Circle = Maps.Circle;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn('react-native-maps failed to load:', e.message);
  }
}

const DEFAULT_REGION = {
  latitude: Number(APP_CONFIG.defaultLocation.latitude) || 23.0225,
  longitude: Number(APP_CONFIG.defaultLocation.longitude) || 72.5714,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const parseValidCoord = (item) => {
  const rawLat = item?.latitude ?? item?.location?.coordinates?.[1];
  const rawLng = item?.longitude ?? item?.location?.coordinates?.[0];
  if (
    rawLat === null ||
    rawLat === undefined ||
    rawLat === '' ||
    rawLng === null ||
    rawLng === undefined ||
    rawLng === ''
  ) {
    return null;
  }
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  return isValidCoordinate(lat, lng) ? { latitude: lat, longitude: lng } : null;
};

const STATUS_PIN_COLORS = {
  Resolved: COLORS.resolved,
  'In Progress': COLORS.inProgress,
  'Under Review': COLORS.underReview,
  Reported: COLORS.pending,
};

export default function NearbyMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const mapRef = useRef(null);
  const mapReadyRef = useRef(false);

  const [issues, setIssues] = useState([]);
  const [radiusKm, setRadiusKm] = useState(3); // 1 | 3 | 5 | 'all'
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'
  const [searchCenter, setSearchCenter] = useState(null); // { latitude, longitude }
  const [isManualCenter, setIsManualCenter] = useState(false);

  const [loadingIssues, setLoadingIssues] = useState(false);
  const [locating, setLocating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');
  const [apiError, setApiError] = useState('');
  const [manualModalVisible, setManualModalVisible] = useState(false);

  const safeAnimateToRegion = useCallback((coords, radKm) => {
    if (!mapReadyRef.current || !mapRef.current || !coords) return;
    try {
      const numericKm = radKm === 'all' ? 12 : Number(radKm) || 3;
      const delta = Math.max(0.015, (numericKm / 111) * 2.4);
      mapRef.current.animateToRegion(
        {
          latitude: Number(coords.latitude),
          longitude: Number(coords.longitude),
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        450
      );
    } catch (e) {
      console.warn('Map animateToRegion skipped:', e.message);
    }
  }, []);

  // Fetch issues independently so map stays visible even if API fails or returns 0 items
  const fetchIssuesForMap = useCallback(
    async (coords, radKm) => {
      try {
        setLoadingIssues(true);
        setApiError('');

        const res =
          coords && radKm !== 'all'
            ? await issueService.getNearby(coords.latitude, coords.longitude, radKm)
            : await issueService.getAll({ limit: 100 });

        const items = res?.data?.issues || [];
        const seen = new Set();
        const valid = [];

        for (const item of items) {
          const parsed = parseValidCoord(item);
          if (item?._id && !seen.has(item._id) && parsed) {
            seen.add(item._id);
            valid.push({
              ...item,
              latitude: parsed.latitude,
              longitude: parsed.longitude,
            });
          }
        }

        setIssues(valid);
        setSelectedIssue((prev) =>
          prev ? valid.find((v) => v._id === prev._id) || null : null
        );

        // Center map on the first valid public pin when user GPS is unavailable
        if ((!coords || radKm === 'all') && valid.length > 0) {
          safeAnimateToRegion(coords || valid[0], radKm);
        }
      } catch (err) {
        console.warn('Error fetching map issues:', err.message);
        setApiError(err.message || 'Unable to load complaints from backend.');
      } finally {
        setLoadingIssues(false);
        setRefreshing(false);
      }
    },
    [safeAnimateToRegion]
  );

  const fetchDeviceLocationAndIssues = useCallback(
    async (radKm = radiusKm, forceGps = false) => {
      if (isManualCenter && searchCenter && !forceGps) {
        await fetchIssuesForMap(searchCenter, radKm);
        return;
      }

      setLocating(true);
      const gps = await getCurrentGpsPosition();

      if (gps.granted && gps.coords) {
        setHasLocationPermission(true);
        setLocationNotice('');
        setSearchCenter(gps.coords);
        setIsManualCenter(false);
        safeAnimateToRegion(gps.coords, radKm);
        await fetchIssuesForMap(gps.coords, radKm);
      } else {
        setHasLocationPermission(Boolean(gps.granted));
        setLocationNotice(
          gps.message ||
            'Location unavailable. Enable GPS or tap Set Pin to filter by distance.'
        );
        // Load available issues even when user GPS is unavailable
        await fetchIssuesForMap(searchCenter, radKm);
      }

      setLocating(false);
      setRefreshing(false);
    },
    [radiusKm, isManualCenter, searchCenter, fetchIssuesForMap, safeAnimateToRegion]
  );

  // Load once on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchDeviceLocationAndIssues(radiusKm, false);
    }, [radiusKm])
  );

  // When map becomes ready after location arrived earlier, center it cleanly
  useEffect(() => {
    if (mapReadyRef.current && searchCenter) {
      safeAnimateToRegion(searchCenter, radiusKm);
    }
  }, [searchCenter, radiusKm, safeAnimateToRegion]);

  const handleSelectRadius = async (km) => {
    setRadiusKm(km);
    safeAnimateToRegion(searchCenter || DEFAULT_REGION, km);
    await fetchIssuesForMap(searchCenter, km);
  };

  const handleManualLocationPicked = async ({ latitude, longitude }) => {
    const manualCoords = {
      latitude: Number(latitude),
      longitude: Number(longitude),
    };
    setManualModalVisible(false);
    setIsManualCenter(true);
    setSearchCenter(manualCoords);
    setLocationNotice('Showing nearby complaints around selected map pin.');
    safeAnimateToRegion(manualCoords, radiusKm);
    await fetchIssuesForMap(manualCoords, radiusKm);
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

  const getMarkerPinColor = (status) =>
    STATUS_PIN_COLORS[normalizeStatusLabel(status)] || COLORS.pending;

  const renderListCard = ({ item }) => (
    <IssueCard
      issue={item}
      onPress={() => router.push(`/(citizen)/issues/${item._id}`)}
      showSupportButton
      currentUserId={user?._id}
      onIssueUpdated={handleIssueUpdated}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        title="Nearby Issues"
        subtitle={
          radiusKm === 'all'
            ? `${issues.length} public street reports`
            : searchCenter
            ? `${issues.length} reports within ${radiusKm} km`
            : `${issues.length} street reports`
        }
        rightComponent={
          <View style={styles.viewToggle}>
            <TouchableOpacity
              onPress={() => fetchIssuesForMap(searchCenter, radiusKm)}
              style={styles.viewToggleBtn}
              accessibilityLabel="Refresh map issues"
            >
              <Ionicons name="refresh" size={16} color={COLORS.primary} />
            </TouchableOpacity>
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
          {[...DISTANCE_FILTERS_KM, 'all'].map((km) => {
            const active = radiusKm === km;
            return (
              <TouchableOpacity
                key={String(km)}
                onPress={() => handleSelectRadius(km)}
                style={[styles.radiusChip, active && styles.radiusChipActive]}
              >
                <Text
                  style={[
                    styles.radiusChipText,
                    active && styles.radiusChipTextActive,
                  ]}
                >
                  {km === 'all' ? 'All' : `${km} km`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.locButtonsRow}>
          <TouchableOpacity
            onPress={() => fetchDeviceLocationAndIssues(radiusKm, true)}
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
              Set Pin
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Non-blocking Location or API Status Banner (never hides the map) */}
      {locationNotice || apiError ? (
        <View style={styles.bannerNotice}>
          <Ionicons
            name={apiError ? 'alert-circle-outline' : 'location-outline'}
            size={16}
            color={apiError ? COLORS.danger : COLORS.pending}
          />
          <Text style={styles.bannerNoticeText} numberOfLines={2}>
            {apiError || locationNotice}
          </Text>
          {apiError ? (
            <TouchableOpacity
              onPress={() => fetchIssuesForMap(searchCenter, radiusKm)}
              style={styles.retryMiniBtn}
            >
              <Text style={styles.retryMiniText}>Retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Main View: List View OR Always-Visible Interactive Map */}
      {viewMode === 'list' ? (
        <FlatList
          data={issues}
          keyExtractor={(item) => item._id}
          renderItem={renderListCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.xl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchDeviceLocationAndIssues(radiusKm, false);
              }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            !loadingIssues ? (
              <EmptyState
                icon="checkmark-circle-outline"
                title={
                  searchCenter && radiusKm !== 'all'
                    ? `No Issues Within ${radiusKm} km`
                    : 'No Complaints Found'
                }
                description="Try expanding your distance filter to All or picking another pin location."
                actionLabel={radiusKm !== 'all' ? 'Show All Issues' : 'Set Map Pin'}
                onAction={() =>
                  radiusKm !== 'all'
                    ? handleSelectRadius('all')
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
              initialRegion={DEFAULT_REGION}
              showsUserLocation={hasLocationPermission && !isManualCenter}
              showsMyLocationButton={false}
              zoomEnabled
              scrollEnabled
              pitchEnabled
              rotateEnabled
              onMapReady={() => {
                mapReadyRef.current = true;
                if (searchCenter) {
                  safeAnimateToRegion(searchCenter, radiusKm);
                } else if (issues.length > 0) {
                  safeAnimateToRegion(issues[0], radiusKm);
                }
              }}
              onPress={() => setSelectedIssue(null)}
            >
              {searchCenter && radiusKm !== 'all' && Circle ? (
                <Circle
                  center={{
                    latitude: searchCenter.latitude,
                    longitude: searchCenter.longitude,
                  }}
                  radius={radiusKm * 1000}
                  strokeColor="rgba(13, 148, 136, 0.55)"
                  fillColor="rgba(13, 148, 136, 0.10)"
                />
              ) : null}

              {isManualCenter && searchCenter && Marker ? (
                <Marker
                  coordinate={{
                    latitude: searchCenter.latitude,
                    longitude: searchCenter.longitude,
                  }}
                  pinColor={COLORS.secondary}
                  title="Selected Search Center"
                />
              ) : null}

              {Marker
                ? issues.map((issue) => (
                    <Marker
                      key={`${issue._id}_${issue.status}`}
                      coordinate={{
                        latitude: issue.latitude,
                        longitude: issue.longitude,
                      }}
                      title={issue.title}
                      description={`${issue.category} • ${normalizeStatusLabel(issue.status)}${
                        typeof issue.distanceKm === 'number'
                          ? ` • ${issue.distanceKm.toFixed(2)} km`
                          : ''
                      }`}
                      pinColor={getMarkerPinColor(issue.status)}
                      onPress={(e) => {
                        if (e?.stopPropagation) e.stopPropagation();
                        setSelectedIssue(issue);
                      }}
                    />
                  ))
                : null}
            </MapView>
          ) : (
            <View style={styles.fallbackBox}>
              <Ionicons name="map-outline" size={44} color={COLORS.primary} />
              <Text style={styles.fallbackTitle}>Map Unavailable on Web</Text>
              <Text style={styles.fallbackText}>
                Open the app in Android Expo Go for the interactive Google Map, or switch to List View above.
              </Text>
            </View>
          )}

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.pending }]} />
              <Text style={styles.legendText}>Pending</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.underReview }]} />
              <Text style={styles.legendText}>Review</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.inProgress }]} />
              <Text style={styles.legendText}>In Progress</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.resolved }]} />
              <Text style={styles.legendText}>Resolved</Text>
            </View>
          </View>

          {/* Non-blocking empty-state pill over the map when 0 nearby complaints */}
          {!loadingIssues && !locating && !selectedIssue && issues.length === 0 ? (
            <View style={styles.emptyMapPill}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.emptyMapPillText}>
                {searchCenter && radiusKm !== 'all'
                  ? `No issues within ${radiusKm} km. Try All or Set Pin.`
                  : 'No complaints plotted yet.'}
              </Text>
            </View>
          ) : null}

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
                      ? `${selectedIssue.distanceKm.toFixed(2)} km away • `
                      : ''}
                    {selectedIssue.createdAt
                      ? `Reported: ${new Date(selectedIssue.createdAt).toLocaleDateString()}`
                      : 'Mapped Location'}
                  </Text>
                  <Text style={styles.previewAddress} numberOfLines={1}>
                    {selectedIssue.address ||
                      `${selectedIssue.latitude.toFixed(5)}, ${selectedIssue.longitude.toFixed(5)}`}
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
                <View style={styles.previewActionGroup}>
                  <TouchableOpacity
                    style={styles.directionsMiniBtn}
                    onPress={() =>
                      openGoogleMapsDirections(
                        selectedIssue.latitude,
                        selectedIssue.longitude
                      )
                    }
                  >
                    <Ionicons name="navigate-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.directionsMiniText}>Directions</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.viewDetailsBtn}
                    onPress={() =>
                      router.push(`/(citizen)/issues/${selectedIssue._id}`)
                    }
                  >
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <Ionicons name="arrow-forward" size={14} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {(loadingIssues || locating) ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>
                {locating ? 'Getting GPS location...' : `Loading issues (${radiusKm} km)...`}
              </Text>
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
  retryMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
  },
  retryMiniText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  mapContainer: {
    flex: 1,
    minHeight: 300,
    position: 'relative',
    backgroundColor: '#e5e7eb',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
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
  emptyMapPill: {
    position: 'absolute',
    bottom: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...SHADOW.card,
  },
  emptyMapPillText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontWeight: '600',
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  previewActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  directionsMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  directionsMiniText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
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
