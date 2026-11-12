import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ManualLocationMap() {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.message}>Manual map pinning is available in the Android client.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    height: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBD9EF',
    backgroundColor: '#E7F1F8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  message: {
    color: '#17324B',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
