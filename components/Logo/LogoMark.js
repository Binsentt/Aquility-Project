import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../styles/theme';

const logoSource = require('../../assets/Aquility-Logo.png');

export default function LogoMark({ showLabel = true, size = 92 }) {
  return (
    <View style={styles.container}>
      <Image
        source={logoSource}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="Aquility logo"
      />
      {showLabel ? <Text style={styles.label}>AQUILITY</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: 1.2,
  },
});
