import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import LogoMark from '../Logo/LogoMark';
import { COLORS, SPACING } from '../../styles/theme';

export default function TopHeader({ title, subtitle }) {
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      <LogoMark showLabel={false} size={44} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: COLORS.navy,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
});
