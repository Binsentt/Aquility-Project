import React from 'react';
import { TouchableOpacity, View, StyleSheet, Text } from 'react-native';

const CaptureButton = React.memo(function CaptureButton({ onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel="Capture water-test strip"
    >
      <View style={styles.ring}>
        <View style={styles.core} />
      </View>
      <Text style={styles.label}>Capture</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  core: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
  },
  label: {
    marginTop: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default CaptureButton;
