import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADII, SHADOWS, SPACING } from '../../styles/theme';
import { loadMapFeed, readCurrentMapLocation } from '../../services/mapLibreMap';
import { api } from '../../services/apiClient';
import MapLibreWaterMap from '../../components/MapLibreWaterMap';

const DEFAULT_CENTER = { latitude: 14.5995, longitude: 120.9842 };

export default function MapScreen({ navigation }) {
  const { scanHistory, mapVersion } = useAuth();
  const scanHistoryRef = useRef(scanHistory);
  scanHistoryRef.current = scanHistory;
  const [userLocation, setUserLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState('Loading live location…');
  const [feedMessage, setFeedMessage] = useState(null);
  const [mapFeed, setMapFeed] = useState(null);

  useEffect(() => {
    let isMounted = true;
    loadMapFeed(() => api.listMapMarkers(), () => scanHistoryRef.current).then((result) => {
      if (!isMounted) return;
      setMapFeed(result.markers);
      setFeedMessage(result.message);
    });
    return () => { isMounted = false; };
  }, [mapVersion]);

  useEffect(() => {
    let isMounted = true;
    readCurrentMapLocation({
      requestPermission: async () => (await Location.requestForegroundPermissionsAsync()).status === 'granted',
      getCurrentPosition: () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    }).then((result) => {
      if (!isMounted) return;
      setUserLocation(result.location);
      setLocationMessage(result.state === 'available'
        ? 'Current location ready.'
        : result.state === 'permission-denied'
          ? 'Location permission is off. Saved scan markers will still appear when available.'
          : 'Unable to read the current location right now.');
    });
    return () => { isMounted = false; };
  }, []);

  const markers = useMemo(
    () => mapFeed ?? [],
    [mapFeed],
  );
  const latestScan = markers[0];
  const center = userLocation || latestScan?.coordinate || DEFAULT_CENTER;
  const emptyMessage = mapFeed === null
    ? 'Loading saved test locations…'
    : feedMessage || (markers.length ? locationMessage : 'No saved test locations yet.');

  return (
    <View style={styles.container}>
      <View style={styles.mapBoard}>
        <MapLibreWaterMap markers={markers} userLocation={userLocation} center={center} />
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
            {feedMessage ? <Text style={styles.notice}>{feedMessage}</Text> : null}
          </>
        ) : <Text style={styles.description}>{emptyMessage}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBFF' },
  mapBoard: { flex: 1, backgroundColor: '#E8F7FF', position: 'relative' },
  bottomSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADII.hero, borderTopRightRadius: RADII.hero, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.soft },
  bottomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
  viewAll: { color: COLORS.primary, fontWeight: '700' },
  location: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  status: { fontSize: 15, fontWeight: '900', marginBottom: 10 },
  description: { color: COLORS.muted, lineHeight: 20 },
  notice: { color: COLORS.muted, lineHeight: 18, marginTop: 6, fontSize: 12 },
});
