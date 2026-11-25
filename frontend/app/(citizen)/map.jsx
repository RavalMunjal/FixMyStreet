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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import Badge from '../../components/Badge';
import { issueService } from '../../services/api';
import { APP_CONFIG } from '../../constants/config';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../../constants/theme';

let MapView, Marker;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
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
  const mapRef = useRef(null);
  const hasCenteredRef = useRef(false);

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');
  const [mapError, setMapError] = useState('');

  const loadMapData = useCallback(async () => {
    try {
      setLoading(true);
      setMapError('');

      let userCoords = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasLocationPermission(true);
        setLocationNotice('');
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          userCoords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          };
        } catch (locErr) {
          console.warn('GPS location fetch error:', locErr);
          setLocationNotice('GPS signal unavailable. Showing reported issues.');
        }
      } else {
        setHasLocationPermission(false);
        setLocationNotice('Location permission denied. Enable GPS to center on you.');
      }

      const res = await issueService.getAll({ limit: 100 });
      const items = res?.data?.issues || [];
      const validCoordinates = items.filter(hasValidCoords);
      setIssues(validCoordinates);

      if (!hasCenteredRef.current && mapRef.current) {
        if (userCoords) {
          mapRef.current.animateToRegion(userCoords, 500);
          hasCenteredRef.current = true;
        } else if (validCoordinates.length > 0) {
          mapRef.current.fitToCoordinates(
            validCoordinates.map((i) => ({
              latitude: i.latitude,
              longitude: i.longitude,
            })),
            {
              edgePadding: { top: 80, right: 50, bottom: 140, left: 50 },
              animated: true,
            }
          );
          hasCenteredRef.current = true;
        }
      }
    } catch (err) {
      console.warn('Error loading map data:', err);
      setMapError(err.message || 'Unable to load complaints for map.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMapData();
    }, [loadMapData])
  );

  const getMarkerPinColor = (status) => {
    switch (status) {
      case 'Resolved':
        return COLORS.resolved;
      case 'In Progress':
        return COLORS.inProgress;
      default:
        return COLORS.pending;
    }
  };

  const centerOnUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Denied',
          'Please allow location access in device settings to center the map on your location.'
        );
        return;
      }
      setHasLocationPermission(true);
      setLocationNotice('');
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        },
        500
      );
    } catch (e) {
      Alert.alert('Location Error', 'Unable to fetch current GPS location.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        title="Nearby Issues Map"
        subtitle={`${issues.length} street reports mapped`}
        rightComponent={
          <TouchableOpacity onPress={loadMapData} style={styles.refreshIconBtn}>
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {MapView ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={APP_CONFIG.defaultLocation}
            showsUserLocation={hasLocationPermission}
            showsMyLocationButton={false}
            onPress={() => setSelectedIssue(null)}
          >
            {issues.map((issue) => (
              <Marker
                key={`${issue._id}_${issue.status}`}
                coordinate={{
                  latitude: issue.latitude,
                  longitude: issue.longitude,
                }}
                title={issue.title}
                description={`${issue.category} • ${issue.status}`}
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
            <Text style={styles.fallbackTitle}>Map Preview Unavailable</Text>
            <Text style={styles.fallbackText}>
              Native map rendering requires Android/iOS. Below are {issues.length} mapped complaints:
            </Text>
            <FlatList
              data={issues}
              keyExtractor={(item) => item._id}
              style={styles.fallbackList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.fallbackItem}
                  onPress={() => router.push(`/(citizen)/issues/${item._id}`)}
                >
                  <Text style={styles.fallbackItemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.fallbackItemCoords}>
                    {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)} • {item.status}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Map Legend (left-aligned with room for recenter button) */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: COLORS.pending }]} />
            <Text style={styles.legendText}>Pending</Text>
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

        {/* Recenter / Request GPS Button */}
        <TouchableOpacity style={styles.recenterBtn} onPress={centerOnUser}>
          <Ionicons name="locate" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        {/* Non-blocking GPS Notice or Error */}
        {(locationNotice || mapError) && !loading ? (
          <View style={styles.noticeBanner}>
            <Ionicons
              name={mapError ? 'alert-circle-outline' : 'location-outline'}
              size={16}
              color={mapError ? COLORS.danger : COLORS.pending}
            />
            <Text style={styles.noticeText} numberOfLines={2}>
              {mapError || locationNotice}
            </Text>
          </View>
        ) : null}

        {/* Bottom Selected Issue Preview Card */}
        {selectedIssue ? (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.previewBadges}>
                <Badge category={selectedIssue.category} size="sm" />
                <Badge status={selectedIssue.status} size="sm" />
              </View>
              <TouchableOpacity
                onPress={() => setSelectedIssue(null)}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                <Text style={styles.previewAddress} numberOfLines={2}>
                  {selectedIssue.address ||
                    `${selectedIssue.latitude.toFixed(4)}, ${selectedIssue.longitude.toFixed(4)}`}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.viewDetailsBtn}
              onPress={() =>
                router.push(`/(citizen)/issues/${selectedIssue._id}`)
              }
            >
              <Text style={styles.viewDetailsText}>View Full Complaint Details</Text>
              <Ionicons name="arrow-forward" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : null}

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading issue markers...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  refreshIconBtn: {
    padding: 4,
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  legend: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: 68,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
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
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  recenterBtn: {
    position: 'absolute',
    right: SPACING.md,
    top: SPACING.md,
    backgroundColor: COLORS.surface,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.elevated,
  },
  noticeBanner: {
    position: 'absolute',
    top: 68,
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    ...SHADOW.card,
  },
  noticeText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  previewCard: {
    position: 'absolute',
    bottom: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
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
    marginBottom: SPACING.sm,
  },
  previewBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    flex: 1,
  },
  closeBtn: {
    padding: 2,
  },
  previewContent: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  previewThumb: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
    marginRight: SPACING.md,
  },
  previewDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  previewAddress: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  viewDetailsBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  viewDetailsText: {
    color: '#ffffff',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    marginRight: 6,
  },
  fallbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
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
    marginBottom: SPACING.md,
  },
  fallbackList: {
    width: '100%',
  },
  fallbackItem: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  fallbackItemTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  fallbackItemCoords: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: SPACING.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
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
