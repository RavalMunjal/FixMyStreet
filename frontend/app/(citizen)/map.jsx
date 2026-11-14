import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import Badge from '../../components/Badge';
import { issueService } from '../../services/api';
import { APP_CONFIG } from '../../constants/config';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../../constants/theme';

// Safe conditional import for react-native-maps
let MapView, Marker, Callout;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Callout = Maps.Callout;
} catch (e) {
  console.warn('react-native-maps not available in this environment');
}

export default function NearbyMapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [region, setRegion] = useState({
    latitude: APP_CONFIG.defaultLocation.latitude,
    longitude: APP_CONFIG.defaultLocation.longitude,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  useEffect(() => {
    initMap();
  }, []);

  const initMap = async () => {
    try {
      setLoading(true);

      // 1. Get user GPS coordinates if permitted
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasLocationPermission(true);
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        } catch (locErr) {
          console.warn('GPS location fetch error:', locErr);
        }
      }

      // 2. Load all issues from backend to plot on map
      const res = await issueService.getAll({ limit: 100 });
      const items = res?.data?.issues || [];
      // Filter only items with valid coordinates
      const validCoordinates = items.filter(
        (i) =>
          typeof i.latitude === 'number' &&
          typeof i.longitude === 'number' &&
          !isNaN(i.latitude) &&
          !isNaN(i.longitude)
      );
      setIssues(validCoordinates);
    } catch (err) {
      console.warn('Error loading map data:', err);
    } finally {
      setLoading(false);
    }
  };

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
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      });
    } catch (e) {
      Alert.alert('Location Error', 'Unable to fetch current location.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Nearby Issues Map"
        subtitle={`${issues.length} street reports mapped`}
      />

      <View style={styles.container}>
        {MapView ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            showsUserLocation={hasLocationPermission}
            showsMyLocationButton={false}
          >
            {issues.map((issue) => (
              <Marker
                key={issue._id}
                coordinate={{
                  latitude: issue.latitude,
                  longitude: issue.longitude,
                }}
                pinColor={getMarkerPinColor(issue.status)}
                onPress={() => setSelectedIssue(issue)}
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.fallbackBox}>
            <Ionicons name="map-outline" size={48} color={COLORS.primary} />
            <Text style={styles.fallbackTitle}>Interactive Map View</Text>
            <Text style={styles.fallbackText}>
              Displaying {issues.length} active street issues registered in MongoDB.
            </Text>
          </View>
        )}

        {/* Map Legend */}
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

        {/* Recenter GPS Button */}
        {hasLocationPermission && (
          <TouchableOpacity style={styles.recenterBtn} onPress={centerOnUser}>
            <Ionicons name="locate" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Bottom Selected Issue Preview Card */}
        {selectedIssue ? (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Badge category={selectedIssue.category} size="sm" />
              <Badge status={selectedIssue.status} size="sm" />
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
                <Text style={styles.previewAddress} numberOfLines={1}>
                  {selectedIssue.address || 'GPS Coordinates'}
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
            <ActivityIndicator size="large" color={COLORS.primary} />
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
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOW.card,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: {
    fontSize: FONT_SIZE.xs,
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
    top: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  loadingText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontWeight: '500',
  },
});
