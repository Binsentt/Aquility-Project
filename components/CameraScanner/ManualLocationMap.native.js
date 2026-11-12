import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { OPENFREEMAP_LIBERTY_STYLE, toMapLibreLngLat } from '../../services/mapLibreMap';

const DEFAULT_CENTER = { latitude: 14.5995, longitude: 120.9842 };

export default function ManualLocationMap({ center, selection, onPress }) {
  const mapCenter = toMapLibreLngLat(center || DEFAULT_CENTER) || toMapLibreLngLat(DEFAULT_CENTER);
  const selectedPoint = toMapLibreLngLat(selection);

  return (
    <View style={styles.container}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={OPENFREEMAP_LIBERTY_STYLE}
        attribution
        compass
        onPress={onPress}
      >
        <Camera initialViewState={{ center: mapCenter, zoom: 11 }} />
        {selectedPoint ? (
          <Marker id="manual-sample-location" lngLat={selectedPoint} anchor="bottom">
            <View style={styles.marker}>
              <View style={styles.markerInner} />
            </View>
          </Marker>
        ) : null}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#BBD9EF',
    backgroundColor: '#dfeef9',
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(21, 141, 176, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1588B5',
  },
});
