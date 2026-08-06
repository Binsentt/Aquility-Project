import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADII, SIZES, SPACING } from '../../styles/theme';

export default function FormInput({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  helperText,
  autoCapitalize = 'none',
  numericOnly = false,
}) {
  const [showPassword, setShowPassword] = useState(false);

  const handleTextChange = (text) => {
    let out = text;
    if (numericOnly) {
      out = String(text).replace(/\D+/g, '');
    }
    if (onChangeText) onChangeText(out);
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        <TextInput
          value={value}
          onChangeText={handleTextChange}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={COLORS.muted}
          keyboardType={numericOnly ? 'numeric' : keyboardType}
          secureTextEntry={secureTextEntry && !showPassword}
          autoCapitalize={autoCapitalize}
          style={styles.input}
        />
        {secureTextEntry ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.visibilityButton}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <MaterialCommunityIcons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.control,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    minHeight: SIZES.touchTarget,
    paddingVertical: 8,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  visibilityButton: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget - 2,
    marginRight: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.primary,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.danger,
  },
});
