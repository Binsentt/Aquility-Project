import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../styles/theme';

export default function NotificationPanel({ message, type = 'info' }) {
  const backgroundColor =
    type === 'error' ? COLORS.error : type === 'success' ? COLORS.success : COLORS.primaryLight;

  return (
    <View style={[styles.container, { backgroundColor }]}> 
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 16,
    marginVertical: 12,
  },
  message: {
    color: COLORS.navy,
    fontSize: 14,
    lineHeight: 20,
  },
});
