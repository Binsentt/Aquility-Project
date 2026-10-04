import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import {
  buildMapLibreMarkers,
  mapLoadMessage,
  mapLoadReducer,
  OPENFREEMAP_LIBERTY_STYLE,
  toMapLibreLngLat,
} from '../services/mapLibreMap';

const DEFAULT_CENTER = { latitude: 14.5995, longitude: 120.9842 };
const MAP_LOAD_TIMEOUT_MS = 20000;

function formatTestDate(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Date unavailable';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : 'Date unavailable';
}

function displayText(value, fallback = 'Unavailable') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function formatPHMeasurement(value, category) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  return `${value.toFixed(2)}${category ? ` — ${category}` : ''}`;
}

export default function MapLibreWaterMap({
  markers = [],
  userLocation = null,
  center = null,
  detailBottomOffset = 14,
}) {
  const [mapState, dispatchMapState] = useReducer(mapLoadReducer, 'loading');
  const [retryKey, setRetryKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const cameraRef = useRef(null);
  const lastCameraCenter = useRef(null);

  const renderedMarkers = useMemo(() => buildMapLibreMarkers(markers), [markers]);
  const userLngLat = useMemo(() => toMapLibreLngLat(userLocation), [userLocation]);
  const candidateCenter = center || userLocation || renderedMarkers[0]?.coordinate || DEFAULT_CENTER;
  const cameraCenter = useMemo(() => toMapLibreLngLat(candidateCenter) || toMapLibreLngLat(DEFAULT_CENTER), [candidateCenter]);
  const selectedMarker = renderedMarkers.find((marker) => marker.id === selectedId) || null;

  useEffect(() => {
    const timeout = setTimeout(() => dispatchMapState('timeout'), MAP_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [retryKey]);

  useEffect(() => {
    if (!cameraCenter || mapState !== 'ready') return;
    const key = `${cameraCenter[0]},${cameraCenter[1]}`;
    if (!lastCameraCenter.current) {
      cameraRef.current?.jumpTo({ center: cameraCenter, zoom: 11 });
    } else if (lastCameraCenter.current !== key) {
      cameraRef.current?.easeTo({ center: cameraCenter, zoom: 12, duration: 350 });
    }
    lastCameraCenter.current = key;
  }, [cameraCenter, mapState]);

  useEffect(() => {
    if (selectedId && !renderedMarkers.some((marker) => marker.id === selectedId)) setSelectedId(null);
  }, [renderedMarkers, selectedId]);

  const failMap = () => {
    dispatchMapState('failed');
    setSelectedId(null);
  };
  const retryMap = () => {
    setSelectedId(null);
    lastCameraCenter.current = null;
    dispatchMapState('retry');
    setRetryKey((current) => current + 1);
  };

  return (
    <View style={styles.container}>
      <Map
        key={retryKey}
        style={StyleSheet.absoluteFill}
        mapStyle={OPENFREEMAP_LIBERTY_STYLE}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        compass
        androidView="texture"
        onDidFailLoadingMap={failMap}
        onDidFinishRenderingMapFully={() => dispatchMapState('ready')}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: cameraCenter, zoom: 11 }}
        />
        {userLngLat ? (
          <Marker id="current-location" lngLat={userLngLat} anchor="center">
            <View style={styles.userMarkerOuter}><View style={styles.userMarkerInner} /></View>
          </Marker>
        ) : null}
        {renderedMarkers.map((marker) => (
          <Marker
            key={marker.id}
            id={marker.id}
            lngLat={marker.lngLat}
            anchor="bottom"
            onPress={() => setSelectedId(marker.id)}
          >
            <View style={[styles.marker, { backgroundColor: marker.pinColor || '#718096' }]}>
              <View style={styles.markerCenter} />
            </View>
          </Marker>
        ))}
      </Map>

      {mapState === 'failed' ? (
        <View style={styles.unavailableOverlay}>
          <Text style={styles.unavailableTitle}>Map unavailable</Text>
          <Text style={styles.unavailableText}>{mapLoadMessage('failed')}</Text>
          <Pressable accessibilityRole="button" onPress={retryMap} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {selectedMarker ? (
        <View style={[styles.markerDetails, { bottom: detailBottomOffset }]}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle} numberOfLines={2}>{displayText(selectedMarker.title, 'Water test')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close marker details" onPress={() => setSelectedId(null)}>
              <Text style={styles.closeDetails}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.detailsText}>{displayText(selectedMarker.barangay)}, {displayText(selectedMarker.municipality)}</Text>
          <Text style={styles.detailsText}>Source: {displayText(selectedMarker.sourceType)}</Text>
          <Text style={[styles.detailsText, { color: selectedMarker.pinColor || '#718096' }]}>Status: {displayText(selectedMarker.overallStatus)}</Text>
          <Text style={styles.detailsText}>Tested: {formatTestDate(selectedMarker.createdAt)}</Text>
          <Text style={styles.detailsText}>pH: {formatPHMeasurement(selectedMarker.pH, selectedMarker.pHCategory)}</Text>
          <Text style={styles.detailsText}>Nitrite: {displayText(selectedMarker.nitriteDisplay)}</Text>
          {selectedMarker.nitriteStatus ? <Text style={styles.detailsText}>Nitrite Status: {displayText(selectedMarker.nitriteStatus)}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  userMarkerOuter: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(46,134,171,0.24)', borderColor: 'rgba(46,134,171,0.55)', borderWidth: 1 },
  userMarkerInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2E86AB', borderColor: '#FFFFFF', borderWidth: 2 },
  marker: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  markerCenter: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  unavailableOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(247,251,255,0.96)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  unavailableTitle: { fontSize: 17, fontWeight: '800', color: '#16324F', marginBottom: 6 },
  unavailableText: { textAlign: 'center', color: '#607080', lineHeight: 20, marginBottom: 14 },
  retryButton: { backgroundColor: '#31BBD1', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  markerDetails: { position: 'absolute', left: 12, right: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 13, elevation: 6 },
  detailsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  detailsTitle: { flex: 1, color: '#16324F', fontWeight: '800', fontSize: 14 },
  closeDetails: { color: '#168FA5', fontWeight: '700', paddingHorizontal: 4 },
  detailsText: { color: '#34495E', fontSize: 12, marginTop: 4 },
});
