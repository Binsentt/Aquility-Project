import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADII, SIZES, SPACING } from '../../styles/theme';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Map preview</Text>
        <Text style={styles.body}>
          The interactive map view is available on Android and iOS. This web build shows a safe fallback while the native map module is not loaded.
        </Text>
        <Text style={styles.body}>Saved scan locations and current location will appear in the native app experience.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FBFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.navy,
    marginBottom: SPACING.sm,
  },
  body: {
    color: COLORS.muted,
    lineHeight: 22,
    marginTop: 8,
  },
});
