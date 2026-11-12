import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADII, SHADOWS, SPACING } from '../../styles/theme';
import { loadMapFeed, readCurrentMapLocation } from '../../services/mapLibreMap';
import { api } from '../../services/apiClient';
import MapLibreWaterMap from '../../components/MapLibreWaterMap';

const DEFAULT_CENTER = { latitude: 14.5995, longitude: 120.9842 };

export default function FullMapScreen({ navigation }) {
  const { scanHistory, mapVersion } = useAuth();
  const scanHistoryRef = useRef(scanHistory);
  scanHistoryRef.current = scanHistory;
  const [userLocation, setUserLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState('Loading location…');
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
        ? 'Your current location is ready.'
        : result.state === 'permission-denied'
          ? 'Location access is required to display your current position.'
          : 'Unable to fetch your current location right now.');
    });
    return () => { isMounted = false; };
  }, []);

  const markers = useMemo(
    () => mapFeed ?? [],
    [mapFeed],
  );
  const center = userLocation || markers[0]?.coordinate || DEFAULT_CENTER;
  const footerMessage = mapFeed === null
    ? 'Loading saved test locations…'
    : feedMessage || (markers.length ? locationMessage : 'No saved test locations yet.');

  return (
    <View style={styles.container}>
      <View style={[styles.header, SHADOWS.strong]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to map" onPress={() => navigation.goBack()}><MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.navy} /></TouchableOpacity>
        <Text style={styles.title}>Community Map</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.mapArea}>
        <MapLibreWaterMap markers={markers} userLocation={userLocation} center={center} detailBottomOffset={82} />
        <View style={styles.mapFooter}>
          <Text style={styles.footerTitle}>Map overview</Text>
          <Text style={styles.footerText}>{markers.length ? `Saved scan locations: ${markers.length}` : footerMessage}</Text>
          {feedMessage ? <Text style={styles.footerNotice}>{feedMessage}</Text> : null}
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
  mapFooter: { padding: SPACING.md, backgroundColor: 'rgba(255,255,255,0.92)' },
  footerTitle: { fontSize: 14, fontWeight: '800', color: COLORS.navy, marginBottom: 4 },
  footerText: { color: COLORS.muted, lineHeight: 20 },
  footerNotice: { color: COLORS.muted, lineHeight: 18, marginTop: 4, fontSize: 12 },
});
