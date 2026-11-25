import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { APP_CONFIG } from '../constants/config';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../constants/theme';

let MapView, Marker, PROVIDER_GOOGLE;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
} catch (e) {
  console.warn('react-native-maps not available');
}

export default function MapPinPickerModal({
  visible,
  initialCoords,
  onClose,
  onConfirm,
}) {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState('');

  const reverseGeocodeCoords = async (latitude, longitude) => {
    try {
      setResolvingAddress(true);
      const list = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (list && list.length > 0) {
        const item = list[0];
        const formatted = [
          item.name,
          item.street,
          item.district || item.subregion,
          item.city,
          item.postalCode,
        ]
          .filter(Boolean)
          .join(', ');
        if (formatted) {
          setResolvedAddress(formatted);
          return formatted;
        }
      }
      const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setResolvedAddress(fallback);
      return fallback;
    } catch (e) {
      const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setResolvedAddress(fallback);
      return fallback;
    } finally {
      setResolvingAddress(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setPermissionNotice('');

    if (
      typeof initialCoords?.latitude === 'number' &&
      typeof initialCoords?.longitude === 'number'
    ) {
      setSelectedCoords({
        latitude: initialCoords.latitude,
        longitude: initialCoords.longitude,
      });
      if (initialCoords.address) {
        setResolvedAddress(initialCoords.address);
      } else {
        reverseGeocodeCoords(initialCoords.latitude, initialCoords.longitude);
      }
    } else {
      useCurrentLocation(true);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && mapReady && selectedCoords && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: selectedCoords.latitude,
          longitude: selectedCoords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        350
      );
    }
  }, [visible, mapReady]);

  const useCurrentLocation = async (silent = false) => {
    try {
      setLocatingGps(true);
      setPermissionNotice('');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionNotice(
          'Location permission denied. Tap anywhere on the map to drop your complaint pin.'
        );
        if (!silent) {
          Alert.alert(
            'Permission Denied',
            'You can enable GPS in Settings or tap directly on the map to pick a location.'
          );
        }
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setSelectedCoords(coords);
      mapRef.current?.animateToRegion(
        {
          ...coords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        400
      );
      await reverseGeocodeCoords(coords.latitude, coords.longitude);
    } catch (err) {
      setPermissionNotice(
        'Could not fetch GPS. Tap anywhere on the map to place the pin.'
      );
      if (!silent) {
        Alert.alert('GPS Error', 'Unable to fetch current device location.');
      }
    } finally {
      setLocatingGps(false);
    }
  };

  const handleMapSelect = async (coordinate) => {
    if (!coordinate) return;
    const coords = {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };
    setSelectedCoords(coords);
    await reverseGeocodeCoords(coords.latitude, coords.longitude);
  };

  const handleConfirm = () => {
    if (!selectedCoords) {
      Alert.alert(
        'No Pin Selected',
        'Tap on the map or use your current GPS location first.'
      );
      return;
    }
    onConfirm({
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
      address:
        resolvedAddress ||
        `${selectedCoords.latitude.toFixed(5)}, ${selectedCoords.longitude.toFixed(5)}`,
    });
  };

  const startRegion = selectedCoords
    ? {
        ...selectedCoords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : APP_CONFIG.defaultLocation;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Top Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>Select Complaint Location</Text>
            <Text style={styles.headerSubtitle}>
              Tap map or drag marker to place exact pin
            </Text>
          </View>
        </View>

        {/* Map Canvas */}
        <View style={styles.mapContainer}>
          {MapView ? (
            <MapView
              ref={mapRef}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={styles.map}
              initialRegion={startRegion}
              showsUserLocation={!permissionNotice}
              showsMyLocationButton={false}
              onMapReady={() => setMapReady(true)}
              onPress={(e) => handleMapSelect(e.nativeEvent.coordinate)}
            >
              {selectedCoords ? (
                <Marker
                  coordinate={selectedCoords}
                  draggable
                  pinColor={COLORS.danger}
                  title="Selected Issue Location"
                  onDragEnd={(e) => handleMapSelect(e.nativeEvent.coordinate)}
                />
              ) : null}
            </MapView>
          ) : (
            <View style={styles.fallbackBox}>
              <Ionicons name="map-outline" size={44} color={COLORS.primary} />
              <Text style={styles.fallbackTitle}>Map Unavailable</Text>
              <Text style={styles.fallbackDesc}>
                Interactive map pin picker requires an Android/iOS device running Expo Go or APK.
              </Text>
            </View>
          )}

          {permissionNotice ? (
            <View style={styles.noticeBanner}>
              <Ionicons name="warning-outline" size={16} color={COLORS.pending} />
              <Text style={styles.noticeText}>{permissionNotice}</Text>
            </View>
          ) : null}

          {/* Floating Use My Current Location Button */}
          <TouchableOpacity
            style={styles.gpsFloatingBtn}
            onPress={() => useCurrentLocation(false)}
            disabled={locatingGps}
          >
            {locatingGps ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="locate" size={22} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Safe Confirmation Sheet */}
        <View style={styles.footerSheet}>
          <View style={styles.selectedInfoBox}>
            <Ionicons name="location" size={20} color={COLORS.danger} />
            <View style={styles.selectedTextCol}>
              <Text style={styles.selectedAddress} numberOfLines={2}>
                {resolvingAddress
                  ? 'Resolving street address...'
                  : resolvedAddress || 'Tap anywhere on the map to place pin'}
              </Text>
              {selectedCoords ? (
                <Text style={styles.selectedCoords}>
                  Lat: {selectedCoords.latitude.toFixed(6)} | Lng:{' '}
                  {selectedCoords.longitude.toFixed(6)}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.footerBtnRow}>
            <Button
              title="Use GPS"
              variant="outline"
              icon="locate-outline"
              loading={locatingGps}
              onPress={() => useCurrentLocation(false)}
              style={styles.gpsBtn}
            />
            <Button
              title="Confirm Location"
              icon="checkmark-circle-outline"
              disabled={!selectedCoords || resolvingAddress}
              onPress={handleConfirm}
              style={styles.confirmBtn}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  closeBtn: {
    padding: 6,
    marginRight: SPACING.sm,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: COLORS.surfaceAlt,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  noticeBanner: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: 68,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.pendingBorder,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...SHADOW.card,
  },
  noticeText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
  },
  gpsFloatingBtn: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.elevated,
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
    marginTop: SPACING.sm,
  },
  fallbackDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  footerSheet: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.md,
  },
  selectedInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  selectedTextCol: {
    flex: 1,
  },
  selectedAddress: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectedCoords: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footerBtnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  gpsBtn: {
    flex: 1,
  },
  confirmBtn: {
    flex: 1.5,
  },
});
