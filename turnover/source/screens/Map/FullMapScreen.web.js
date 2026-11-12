import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADII, SIZES, SPACING } from '../../styles/theme';

export default function FullMapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Full map preview</Text>
        <Text style={styles.body}>
          The full interactive map is available on Android and iOS. On web, this screen uses a lightweight fallback so the bundle stays compatible.
        </Text>
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
