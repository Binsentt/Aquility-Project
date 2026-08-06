import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADII, SPACING } from '../../styles/theme';

export default function StatCard({ title, value, style }) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.value} numberOfLines={2}>{value}</Text>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    flex: 1,
    minWidth: 0,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  title: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
