import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import UPAD_GUIDE_LANDMARKS from './upadGuideLayout.json';

const ScannerOverlay = React.memo(function ScannerOverlay({ detected = false }) {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.backdrop} />
      <View style={styles.guideContainer}>
        <View style={[styles.guideFrame, detected ? styles.guideFrameDetected : null]}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          <View style={styles.padSilhouette}>
            {UPAD_GUIDE_LANDMARKS.map((landmark) => (
              <View
                key={landmark.id}
                style={[
                  styles.landmark,
                  landmark.kind === 'sensing-zone' ? styles.sensingZone : null,
                  landmark.shape === 'square' ? styles.squareFiducial : null,
                  landmark.shape === 'triangle' ? styles.triangleFiducial : null,
                  { left: `${landmark.x * 100}%` },
                ]}
              >
                {landmark.shape === 'triangle' ? <Text style={styles.triangleGlyph}>▲</Text> : null}
                {landmark.kind === 'sensing-zone' ? <Text style={styles.landmarkLabel}>{landmark.label}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 10, 18, 0.36)',
  },
  guideContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideFrame: {
    width: '78%',
    height: '54%',
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
  },
  guideFrameDetected: {
    borderColor: '#6FE7FF',
    shadowColor: '#6FE7FF',
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  padSilhouette: {
    position: 'absolute',
    left: '10%',
    top: '50%',
    width: '80%',
    height: 42,
    marginTop: -21,
    borderRadius: 18,
    backgroundColor: 'rgba(3, 14, 22, 0.76)',
    borderWidth: 1,
    borderColor: 'rgba(111, 231, 255, 0.8)',
  },
  landmark: {
    position: 'absolute',
    top: '50%',
    width: 12,
    height: 12,
    marginTop: -6,
    marginLeft: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensingZone: {
    width: 22,
    height: 22,
    marginTop: -11,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 2,
    borderColor: '#6FE7FF',
  },
  squareFiducial: {
    width: 13,
    height: 13,
    marginTop: -6.5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6FE7FF',
  },
  triangleFiducial: {
    width: 18,
    height: 18,
    marginTop: -9,
  },
  triangleGlyph: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
    textShadowColor: '#6FE7FF',
    textShadowRadius: 4,
  },
  landmarkLabel: {
    position: 'absolute',
    top: 24,
    width: 48,
    left: -13,
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 3,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#6FE7FF',
    borderWidth: 3,
  },
  topLeft: {
    top: 10,
    left: 10,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 10,
    right: 10,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 10,
    left: 10,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 10,
    right: 10,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 10,
  },
});

export default ScannerOverlay;
