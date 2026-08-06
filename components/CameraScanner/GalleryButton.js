import React from 'react';
import { TouchableOpacity, View, StyleSheet, Text } from 'react-native';

const GalleryButton = React.memo(function GalleryButton({ onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel="Open gallery"
    >
      <View style={styles.iconCard}>
        <View style={styles.iconSquare} />
      </View>
      <Text style={styles.label}>Gallery</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    minWidth: 74,
    minHeight: 62,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(7, 16, 25, 0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCard: {
    width: 34,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSquare: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  label: {
    marginTop: 4,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
});

export default GalleryButton;
