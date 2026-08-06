import React from 'react';
import { View, StyleSheet } from 'react-native';

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
