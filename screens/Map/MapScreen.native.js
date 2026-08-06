import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Callout, Marker } from 'react-native-maps';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADII, SHADOWS, SPACING } from '../../styles/theme';
import { markerColorFor } from '../../services/apiMappers';
import { api } from '../../services/apiClient';

export default function MapScreen({ navigation }) {
  const { scanHistory, mapVersion } = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Loading live location…');
  const [mapFeed, setMapFeed] = useState(null);

  useEffect(() => {
    let isMounted = true;

    api.listMapMarkers()
      .then((response) => {
        if (isMounted) setMapFeed(Array.isArray(response.items) ? response.items : []);
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
          if (isMounted) setStatusMessage('Location permission is off. Saved scan markers will still appear when available.');
          return;
        }

        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (isMounted) {
          setUserLocation(location.coords);
          setStatusMessage('Current location ready.');
        }
      } catch {
        if (isMounted) setStatusMessage('Unable to read the current location right now.');
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const markers = useMemo(() => {
    const fallbackMarkers = scanHistory
      .filter((scan) => scan?.location?.latitude && scan?.location?.longitude)
      .map((scan) => ({
        id: scan.id,
        latitude: scan.location.latitude,
        longitude: scan.location.longitude,
        overallStatus: scan.overallStatus || scan.status || 'Moderate',
        capturedAt: scan.capturedAt || scan.createdAt,
        barangay: scan.barangay || scan.user?.barangay || null,
        municipality: scan.municipality || scan.user?.municipality || null,
      }));

    return (mapFeed || fallbackMarkers)
      .filter((scan) => Number.isFinite(Number(scan?.latitude)) && Number.isFinite(Number(scan?.longitude)))
      .map((scan) => ({
        id: scan.id,
        coordinate: { latitude: Number(scan.latitude), longitude: Number(scan.longitude) },
        title: 'Water Test',
        description: scan.overallStatus || 'Moderate',
        barangay: scan.barangay || 'Unavailable',
        municipality: scan.municipality || 'Unavailable',
        overallStatus: scan.overallStatus || 'Moderate',
        pinColor: markerColorFor(scan.overallStatus),
        createdAt: scan.capturedAt || scan.createdAt,
      }));
  }, [mapFeed, scanHistory]);

  const latestScan = markers[0];
  const region = userLocation
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }
    : latestScan
      ? { latitude: latestScan.coordinate.latitude, longitude: latestScan.coordinate.longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }
      : { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.6, longitudeDelta: 0.6 };

  return (
    <View style={styles.container}>
      <View style={styles.mapBoard}>
        <MapView style={styles.map} initialRegion={region} region={region}>
          {userLocation ? <Marker coordinate={userLocation} title="Your location" description="Current position" pinColor="#2E86AB" /> : null}
          {markers.map((marker) => (
            <Marker key={marker.id} coordinate={marker.coordinate} title={marker.title} description={marker.description} pinColor={marker.pinColor}>
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{marker.title}</Text>
                  <Text style={styles.calloutText}>{marker.barangay}, {marker.municipality}</Text>
                  <Text style={[styles.calloutText, { color: marker.pinColor }]}>Status: {marker.overallStatus}</Text>
                  <Text style={styles.calloutText}>Tested: {new Date(marker.createdAt || Date.now()).toLocaleDateString()}</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      </View>

      <View style={[styles.bottomSheet, SHADOWS.strong]}>
        <View style={styles.bottomHeader}>
          <Text style={styles.sheetTitle}>Map summary</Text>
          <TouchableOpacity onPress={() => navigation.navigate('FullMap')}><Text style={styles.viewAll}>Open full map</Text></TouchableOpacity>
        </View>
        {latestScan ? (
          <>
            <Text style={styles.location}>{latestScan.title}</Text>
            <Text style={[styles.status, { color: latestScan.pinColor }]}>{latestScan.overallStatus}</Text>
            <Text style={styles.description}>{`Lat ${latestScan.coordinate.latitude.toFixed(4)}, Lon ${latestScan.coordinate.longitude.toFixed(4)}`}</Text>
          </>
        ) : <Text style={styles.description}>{statusMessage}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBFF' },
  mapBoard: { flex: 1, backgroundColor: '#E8F7FF', position: 'relative' },
  map: { flex: 1 },
  bottomSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADII.hero, borderTopRightRadius: RADII.hero, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.soft },
  bottomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
  viewAll: { color: COLORS.primary, fontWeight: '700' },
  location: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  status: { fontSize: 15, fontWeight: '900', marginBottom: 10 },
  description: { color: COLORS.muted, lineHeight: 20 },
  callout: { width: 220, padding: SPACING.xs },
  calloutTitle: { color: COLORS.navy, fontWeight: '900', marginBottom: 4 },
  calloutText: { color: COLORS.text, fontSize: 12, marginTop: 2 },
});
