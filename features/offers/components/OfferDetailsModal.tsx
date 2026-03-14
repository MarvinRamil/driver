import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { SwipeToAccept } from '@/shared/components/SwipeToAccept';
import type { DriverOffer } from '../types';
import { getPickupAddress, getDropoffAddress, getPickupStop, getDropoffStops, isMultiStopOffer } from '../utils/offerHelpers';

// Manila fallback when no coordinates
const DEFAULT_CENTER: [number, number] = [120.9842, 14.5995];
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

type OfferDetailsModalProps = {
  visible: boolean;
  offer: DriverOffer | null;
  onClose: () => void;
  onAccept?: (offerId: string, bookingId?: string) => Promise<void>;
  onReject?: (offerId: string) => Promise<void>;
  acceptingOfferId?: string | null;
};

function getCoordinatesFromOffer(offer: DriverOffer): { center: [number, number]; pickup?: [number, number]; dropoffs: [number, number][] } {
  const pickupStop = getPickupStop(offer);
  const dropoffStops = getDropoffStops(offer);

  const pickupCoords: [number, number] | undefined =
    pickupStop?.longitude != null && pickupStop?.latitude != null
      ? [pickupStop.longitude, pickupStop.latitude]
      : offer.pickupCoordinates
        ? [offer.pickupCoordinates.longitude, offer.pickupCoordinates.latitude]
        : undefined;

  const dropoffCoords: [number, number][] = dropoffStops
    .filter((s) => s.longitude != null && s.latitude != null)
    .map((s) => [s.longitude!, s.latitude!]);

  if (offer.dropoffCoordinates && dropoffCoords.length === 0) {
    dropoffCoords.push([offer.dropoffCoordinates.longitude, offer.dropoffCoordinates.latitude]);
  }

  const allCoords = [pickupCoords, ...dropoffCoords].filter(Boolean) as [number, number][];
  const center: [number, number] =
    allCoords.length > 0
      ? allCoords.reduce(
          (acc, c) => [acc[0] + c[0], acc[1] + c[1]],
          [0, 0]
        ).map((v, i) => v / allCoords.length) as [number, number]
      : DEFAULT_CENTER;

  return { center, pickup: pickupCoords, dropoffs: dropoffCoords };
}

type LineStringGeoJSON = { type: 'LineString'; coordinates: [number, number][] };

type CoordsResult = { center: [number, number]; pickup?: [number, number]; dropoffs: [number, number][] };

/** Stable map component - defined outside parent to prevent remount blink. Memoized to avoid re-renders from parent countdown. */
const OfferDetailsMap = React.memo(function OfferDetailsMap({
  coords,
  routeGeoJson,
  driverToPickupRouteGeoJson,
  driverLocation,
  driverToPickupDistanceKm,
  mapExpanded,
  onToggleExpand,
  pickupColor,
  dropoffColor,
  driverColor,
  driverIconColor = '#fff',
  driverToPickupPathColor,
  surfaceColor,
  textColor,
  textSecondaryColor,
  borderColor,
}: {
  coords: CoordsResult | null;
  routeGeoJson: LineStringGeoJSON | null;
  driverToPickupRouteGeoJson: LineStringGeoJSON | null;
  driverLocation: [number, number] | null;
  driverToPickupDistanceKm: number | null;
  mapExpanded: boolean;
  onToggleExpand: () => void;
  pickupColor: string;
  dropoffColor: string;
  driverColor: string;
  driverIconColor?: string;
  driverToPickupPathColor: string;
  surfaceColor: string;
  textColor: string;
  textSecondaryColor: string;
  borderColor: string;
}) {
  const MapContent = useMemo(() => {
    if (Platform.OS === 'web') return null;
    try {
      const mapbox = require('@rnmapbox/maps');
      return {
        MapView: mapbox.MapView,
        Camera: mapbox.Camera,
        PointAnnotation: mapbox.PointAnnotation,
        ShapeSource: mapbox.ShapeSource,
        LineLayer: mapbox.LineLayer,
      };
    } catch {
      return null;
    }
  }, []);

  if (!MapContent || !coords) {
    return (
      <View style={[styles.mapPlaceholder, { backgroundColor: borderColor }]}>
        <Ionicons name="map-outline" size={32} color={textSecondaryColor} />
        <ThemedText style={[styles.mapPlaceholderText, { color: textSecondaryColor }]}>
          Map unavailable
        </ThemedText>
      </View>
    );
  }

  const { MapView, Camera, PointAnnotation, ShapeSource, LineLayer } = MapContent;
  const routeShape = routeGeoJson
    ? { type: 'Feature' as const, properties: {}, geometry: routeGeoJson }
    : null;
  const driverToPickupShape = driverToPickupRouteGeoJson
    ? { type: 'Feature' as const, properties: {}, geometry: driverToPickupRouteGeoJson }
    : null;

  // Compute bounds to fit all pins with buffer so none are cut off
  const allPoints: [number, number][] = [...(coords.pickup ? [coords.pickup] : []), ...coords.dropoffs, ...(driverLocation ? [driverLocation] : [])];
  const BOUNDS_PADDING = 0.15; // Expand bounds by 15% on each side
  const bounds = allPoints.length >= 2
    ? (() => {
        const lngs = allPoints.map((p) => p[0]);
        const lats = allPoints.map((p) => p[1]);
        const lngMin = Math.min(...lngs);
        const lngMax = Math.max(...lngs);
        const latMin = Math.min(...lats);
        const latMax = Math.max(...lats);
        const lngRange = Math.max(lngMax - lngMin, 0.002);
        const latRange = Math.max(latMax - latMin, 0.002);
        return {
          ne: [lngMax + lngRange * BOUNDS_PADDING, latMax + latRange * BOUNDS_PADDING] as [number, number],
          sw: [lngMin - lngRange * BOUNDS_PADDING, latMin - latRange * BOUNDS_PADDING] as [number, number],
        };
      })()
    : null;

  const centerCoord = driverLocation && coords.pickup
    ? [(driverLocation[0] + coords.pickup[0]) / 2, (driverLocation[1] + coords.pickup[1]) / 2] as [number, number]
    : coords.center;

  return (
    <View style={styles.minimapWrapper}>
      <MapView
        style={mapExpanded ? StyleSheet.absoluteFill : styles.minimap}
        logoEnabled={!mapExpanded}
        attributionEnabled={!mapExpanded}
        scaleBarEnabled={false}
      >
        <Camera
          {...(bounds
            ? {
                bounds,
                padding: { paddingTop: 60, paddingBottom: 60, paddingLeft: 40, paddingRight: 40 },
              }
            : { centerCoordinate: centerCoord, zoomLevel: mapExpanded ? 14 : 11 })}
          animationDuration={0}
        />
        {driverToPickupShape && (
          <ShapeSource id="driver-pickup-route" shape={driverToPickupShape}>
            <LineLayer
              id="driver-pickup-line"
              style={{
                lineColor: driverToPickupPathColor,
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}
        {routeShape && (
          <ShapeSource id="route-source" shape={routeShape}>
            <LineLayer
              id="route-line"
              style={{
                lineColor: pickupColor,
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}
        {driverLocation && (
          <PointAnnotation key="driver" id="driver" coordinate={driverLocation}>
            <View style={[styles.driverMarker, { backgroundColor: driverColor, borderColor: driverIconColor }]}>
              <Ionicons name="car" size={22} color={driverIconColor} />
            </View>
          </PointAnnotation>
        )}
        {coords.pickup && (
          <PointAnnotation key="pickup" id="pickup" coordinate={coords.pickup}>
            <View style={[styles.pickupMarker, { backgroundColor: pickupColor }]} />
          </PointAnnotation>
        )}
        {coords.dropoffs.map((d, i) => (
          <PointAnnotation key={`dropoff-${i}`} id={`dropoff-${i}`} coordinate={d}>
            <View style={[styles.dropoffMarker, { backgroundColor: dropoffColor }]} />
          </PointAnnotation>
        ))}
      </MapView>
      {driverToPickupDistanceKm != null && driverToPickupDistanceKm > 0 && (
        <View style={[styles.distanceBadge, { backgroundColor: surfaceColor }]}>
          <Ionicons name="car-outline" size={14} color={textColor} />
          <ThemedText style={[styles.distanceBadgeText, { color: textColor }]}>
            {driverToPickupDistanceKm.toFixed(1)} km to pickup
          </ThemedText>
        </View>
      )}
      <TouchableOpacity
        style={[styles.expandButton, { backgroundColor: surfaceColor }]}
        onPress={onToggleExpand}
      >
        <Ionicons
          name={mapExpanded ? 'contract-outline' : 'expand-outline'}
          size={24}
          color={textColor}
        />
      </TouchableOpacity>
    </View>
  );
});

type RouteResult = { route: LineStringGeoJSON; distanceKm: number } | null;

/** Fetch shortest driving route from Mapbox Directions API */
async function fetchRoute(coords: [number, number][]): Promise<LineStringGeoJSON | null> {
  const result = await fetchRouteWithDistance(coords);
  return result?.route ?? null;
}

/** Fetch route and distance from Mapbox Directions API */
async function fetchRouteWithDistance(coords: [number, number][]): Promise<RouteResult> {
  if (!MAPBOX_TOKEN || coords.length < 2) return null;
  const coordsStr = coords.map((c) => c.join(',')).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const firstRoute = data?.routes?.[0];
    const geometry = firstRoute?.geometry;
    const distanceMeters = firstRoute?.distance ?? 0;
    const distanceKm = distanceMeters / 1000;
    if (!geometry?.coordinates) return null;
    return {
      route: { type: 'LineString', coordinates: geometry.coordinates },
      distanceKm,
    };
  } catch {
    return null;
  }
}

export function OfferDetailsModal({
  visible,
  offer,
  onClose,
  onAccept,
  onReject,
  acceptingOfferId = null,
}: OfferDetailsModalProps) {
  const theme = useTheme();
  const [mapExpanded, setMapExpanded] = useState(false);
  const [routeGeoJson, setRouteGeoJson] = useState<LineStringGeoJSON | null>(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [driverToPickupRoute, setDriverToPickupRoute] = useState<LineStringGeoJSON | null>(null);
  const [driverToPickupDistanceKm, setDriverToPickupDistanceKm] = useState<number | null>(null);
  const [showItemImagePopup, setShowItemImagePopup] = useState(false);
  const { height: screenHeight } = Dimensions.get('window');

  useEffect(() => {
    if (visible) setMapExpanded(false);
  }, [visible]);

  const coords = useMemo(() => (offer ? getCoordinatesFromOffer(offer) : null), [offer]);

  // Fetch route pickup -> dropoffs
  const waypointsKey = useMemo(() => {
    if (!coords?.pickup || coords.dropoffs.length === 0) return '';
    return JSON.stringify([coords.pickup, ...coords.dropoffs]);
  }, [coords?.pickup, coords?.dropoffs]);
  useEffect(() => {
    if (!waypointsKey) {
      setRouteGeoJson(null);
      return;
    }
    const waypoints = JSON.parse(waypointsKey) as [number, number][];
    setRouteGeoJson(null);
    fetchRoute(waypoints).then(setRouteGeoJson);
  }, [waypointsKey]);

  // Get driver location and fetch driver -> pickup route
  const pickupKey = coords?.pickup ? JSON.stringify(coords.pickup) : '';
  useEffect(() => {
    if (!visible || !pickupKey) {
      setDriverLocation(null);
      setDriverToPickupRoute(null);
      setDriverToPickupDistanceKm(null);
      return;
    }
    const pickup = JSON.parse(pickupKey) as [number, number];
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          maximumAge: 60000,
        });
        if (cancelled) return;
        const coord: [number, number] = [loc.coords.longitude, loc.coords.latitude];
        setDriverLocation(coord);
        const result = await fetchRouteWithDistance([coord, pickup]);
        if (!cancelled && result) {
          setDriverToPickupRoute(result.route);
          setDriverToPickupDistanceKm(result.distanceKm);
        }
      } catch {
        if (!cancelled) {
          setDriverLocation(null);
          setDriverToPickupRoute(null);
          setDriverToPickupDistanceKm(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, pickupKey]);

  if (!offer) return null;

  const multiStop = isMultiStopOffer(offer);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Item image full-screen popup */}
        <Modal
          visible={showItemImagePopup}
          transparent
          animationType="fade"
          onRequestClose={() => setShowItemImagePopup(false)}>
          <TouchableOpacity
            style={styles.itemImagePopupBackdrop}
            activeOpacity={1}
            onPress={() => setShowItemImagePopup(false)}>
            <View style={styles.itemImagePopupContent}>
              <TouchableOpacity
                style={styles.itemImagePopupClose}
                onPress={() => setShowItemImagePopup(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              {offer.itemImagePath ? (
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => {}}
                  style={styles.itemImagePopupImageWrap}>
                  <Image
                    source={{ uri: offer.itemImagePath }}
                    style={styles.itemImagePopupImage}
                    contentFit="contain"
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
        </Modal>

        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => {
              setMapExpanded(false);
              onClose();
            }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: theme.text }]}>
            Booking Details
          </ThemedText>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Map - minimap or expanded */}
          <View
            style={[
              mapExpanded ? styles.mapExpanded : styles.mapMinimized,
              { height: screenHeight * 0.75 },
            ]}
          >
            <OfferDetailsMap
              coords={coords}
              routeGeoJson={routeGeoJson}
              driverToPickupRouteGeoJson={driverToPickupRoute}
              driverLocation={driverLocation}
              driverToPickupDistanceKm={driverToPickupDistanceKm}
              mapExpanded={mapExpanded}
              onToggleExpand={() => setMapExpanded(!mapExpanded)}
              pickupColor={theme.success}
              dropoffColor={theme.error}
              driverColor="#fff"
              driverIconColor={theme.success}
              driverToPickupPathColor={theme.info}
              surfaceColor={theme.surface}
              textColor={theme.text}
              textSecondaryColor={theme.textSecondary}
              borderColor={theme.border}
            />
          </View>

          {/* Details */}
          <View style={styles.details}>
            <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Booking #
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                {offer.bookingNumber}
              </ThemedText>
            </View>
            <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Fare
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.primary, fontWeight: '700' }]}>
                ₱{offer.estimatedFare.toFixed(2)}
              </ThemedText>
            </View>
            {offer.distanceKm != null && (
              <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Distance
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                  {offer.distanceKm.toFixed(1)} km
                </ThemedText>
              </View>
            )}

            <View style={styles.section}>
              <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
                Pickup
              </ThemedText>
              <ThemedText style={[styles.addressText, { color: theme.text }]}>
                {getPickupAddress(offer)}
              </ThemedText>
              <ThemedText style={[styles.timeText, { color: theme.textSecondary }]}>
                {new Date(offer.scheduleDate).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
                {multiStop ? 'Dropoffs' : 'Dropoff'}
              </ThemedText>
              <ThemedText style={[styles.addressText, { color: theme.text }]}>
                {getDropoffAddress(offer)}
              </ThemedText>
            </View>

            {offer.cargoDescription && (
              <View style={[styles.section, { backgroundColor: theme.surface, borderRadius: 12, padding: 16 }]}>
                <View style={styles.cargoRow}>
                  <Ionicons name="cube-outline" size={20} color={theme.primary} />
                  <ThemedText style={[styles.cargoLabel, { color: theme.textSecondary }]}>
                    Cargo
                  </ThemedText>
                </View>
                <ThemedText style={[styles.cargoText, { color: theme.text }]}>
                  {offer.cargoDescription}
                </ThemedText>
              </View>
            )}

            {offer.itemImagePath ? (
              <TouchableOpacity
                style={[styles.itemImageButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setShowItemImagePopup(true)}
                activeOpacity={0.8}>
                <Ionicons name="image-outline" size={22} color={theme.primary} />
                <ThemedText style={[styles.itemImageButtonText, { color: theme.text }]}>
                  View item image
                </ThemedText>
              </TouchableOpacity>
            ) : null}

            {/* Swipe to Accept / Reject */}
            <View style={[styles.offerActions, { borderTopColor: theme.border }]}>
              <SwipeToAccept
                label="Swipe to accept"
                disabled={acceptingOfferId !== null && acceptingOfferId !== offer.id}
                trackColor={theme.border}
                thumbColor={theme.primary}
                textColor={theme.text}
                style={styles.swipeToAcceptFull}
                onAccept={async () => {
                  if (onAccept) {
                    try {
                      await onAccept(offer.id, offer.bookingId);
                      onClose();
                    } catch (err) {
                      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept offer. Please try again.');
                    }
                  }
                }}
              />
              <TouchableOpacity
                style={[styles.rejectButton, { borderColor: theme.border }]}
                onPress={async () => {
                  if (onReject) {
                    try {
                      await onReject(offer.id);
                      onClose();
                    } catch (err) {
                      Alert.alert('Error', 'Failed to reject offer. Please try again.');
                    }
                  }
                }}
              >
                <Ionicons name="close-outline" size={18} color={theme.textSecondary} />
                <ThemedText style={[styles.rejectButtonText, { color: theme.textSecondary }]}>
                  Not for me
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mapMinimized: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapExpanded: {
    margin: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  minimapWrapper: {
    flex: 1,
    position: 'relative',
  },
  minimap: {
    flex: 1,
    borderRadius: 12,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  mapPlaceholderText: {
    fontSize: 14,
    marginTop: 8,
  },
  expandButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pickupMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
  },
  dropoffMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#fff',
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  distanceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  details: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 15,
    lineHeight: 22,
  },
  timeText: {
    fontSize: 13,
    marginTop: 4,
  },
  cargoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cargoLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  cargoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  itemImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemImageButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemImagePopupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImagePopupContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImagePopupClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  itemImagePopupImageWrap: {
    width: '100%',
    height: '80%',
  },
  itemImagePopupImage: {
    width: '100%',
    height: '100%',
  },
  offerActions: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  swipeToAcceptFull: {
    width: '100%',
    minHeight: 48,
  },
  rejectButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
