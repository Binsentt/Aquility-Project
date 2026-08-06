import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, RADII, SIZES } from '../../styles/theme';

export default function PrimaryButton({ title, onPress, disabled, style, variant = 'primary', ...props }) {
  return (
    <TouchableOpacity
      style={[styles.button, variant === 'secondary' && styles.secondary, style, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      {...props}
    >
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel, disabled && styles.disabledLabel]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: RADII.control,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.touchTarget,
  },
  secondary: {
    backgroundColor: '#E7F6FE',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disabled: {
    backgroundColor: COLORS.border,
  },
  label: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.1,
  },
  secondaryLabel: {
    color: COLORS.primary,
  },
  disabledLabel: {
    color: COLORS.muted,
  },
});
