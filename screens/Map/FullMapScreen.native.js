import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Callout, Marker } from 'react-native-maps';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADII, SHADOWS, SPACING } from '../../styles/theme';
import { filterValidMapMarkers, normalizeMapCoordinate, safeMapFeed } from '../../services/apiMappers';
import { api } from '../../services/apiClient';

export default function FullMapScreen({ navigation }) {
  const { scanHistory, mapVersion } = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Loading location…');
  const [mapFeed, setMapFeed] = useState(null);

  useEffect(() => {
    let isMounted = true;

    api.listMapMarkers()
      .then((response) => {
        if (isMounted) setMapFeed(safeMapFeed(response));
      })
      .catch(() => {
        if (isMounted) {
          setMapFeed(null);
          setStatusMessage('Unable to refresh map markers. Your cached markers are shown when available.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [mapVersion]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setStatusMessage('Location access is required to display your current position.');
          return;
        }
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coordinates = normalizeMapCoordinate(location?.coords?.latitude, location?.coords?.longitude);
        if (!coordinates) {
          if (isMounted) setStatusMessage('Unable to read a valid current location right now.');
          return;
        }
        if (isMounted) {
          setUserLocation(coordinates);
          setStatusMessage('Your current location is ready.');
        }
      } catch {
        if (isMounted) setStatusMessage('Unable to fetch your current location right now.');
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const markers = useMemo(() => {
    const history = Array.isArray(scanHistory) ? scanHistory : [];
    const fallbackMarkers = filterValidMapMarkers(history.map((scan) => ({
      id: scan?.id,
      latitude: scan?.location?.latitude,
      longitude: scan?.location?.longitude,
      overallStatus: scan?.overallStatus || scan?.status,
      capturedAt: scan?.capturedAt || scan?.createdAt,
      barangay: scan?.barangay || scan?.user?.barangay,
      municipality: scan?.municipality || scan?.user?.municipality,
      sampleClass: scan?.sampleClass,
      siteName: scan?.siteName,
      sourceType: scan?.sourceType,
    })));

    return mapFeed || fallbackMarkers;
  }, [mapFeed, scanHistory]);

  const defaultRegion = userLocation
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }
    : markers.length
      ? { latitude: markers[0].coordinate.latitude, longitude: markers[0].coordinate.longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }
      : { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.6, longitudeDelta: 0.6 };

  return (
    <View style={styles.container}>
      <View style={[styles.header, SHADOWS.strong]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.navy} /></TouchableOpacity>
        <Text style={styles.title}>Community Map</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.mapArea}>
        <MapView style={styles.map} initialRegion={defaultRegion}>
          {userLocation ? <Marker coordinate={userLocation} title="Your location" description="This is your current position" pinColor="#2E86AB" /> : null}
          {markers.map((marker) => (
            <Marker key={marker.id} coordinate={marker.coordinate} title={marker.title} description={marker.description} pinColor={marker.pinColor}>
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{marker.title}</Text>
                  <Text style={styles.calloutText}>{marker.barangay}, {marker.municipality}</Text>
                  <Text style={styles.calloutText}>Source: {marker.sourceType || 'Unknown'}</Text>
                  <Text style={[styles.calloutText, { color: marker.pinColor }]}>Status: {marker.overallStatus}</Text>
                  <Text style={styles.calloutText}>Tested: {marker.createdAt ? new Date(marker.createdAt).toLocaleDateString() : 'Date unavailable'}</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
        <View style={styles.mapFooter}>
          <Text style={styles.footerTitle}>Map overview</Text>
          <Text style={styles.footerText}>{markers.length ? `Saved scan locations: ${markers.length}` : statusMessage}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBFF' },
  header: { minHeight: 64, paddingHorizontal: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
  mapArea: { flex: 1, margin: SPACING.md, borderRadius: RADII.card, backgroundColor: '#E8F7FF', overflow: 'hidden' },
  map: { flex: 1 },
  mapFooter: { padding: SPACING.md, backgroundColor: 'rgba(255,255,255,0.92)' },
  footerTitle: { fontSize: 14, fontWeight: '800', color: COLORS.navy, marginBottom: 4 },
  footerText: { color: COLORS.muted, lineHeight: 20 },
  callout: { width: 220, padding: SPACING.xs },
  calloutTitle: { color: COLORS.navy, fontWeight: '900', marginBottom: 4 },
  calloutText: { color: COLORS.text, fontSize: 12, marginTop: 2 },
});
