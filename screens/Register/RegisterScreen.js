import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Formik } from 'formik';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FormInput from '../../components/Input/FormInput';
import LogoMark from '../../components/Logo/LogoMark';
import PrimaryButton from '../../components/Button/PrimaryButton';
import { getPasswordStrength, registerValidationSchema } from '../../utils/validation';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function RegisterScreen() {
  const navigation = useNavigation();
  const { registerUser } = useAuth();

  return (
    <LinearGradient colors={['#F8FCFF', '#EAF8FD', '#D8F3FF']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.goBack()} style={styles.backIconWrap}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={[styles.card, SHADOWS.strong]}>
          <View style={styles.brandRow}>
            <LogoMark showLabel={false} size={54} />
            <View style={styles.brandCopy}>
              <Text style={styles.eyebrow}>AQUILITY</Text>
              <Text style={styles.heading}>Create account</Text>
            </View>
          </View>
          <Text style={styles.subheading}>Register once and access the shared AQUILITY dashboard instantly.</Text>

          <Formik
            initialValues={{ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phoneNumber: '' }}
            validationSchema={registerValidationSchema}
            onSubmit={async (values, { setStatus }) => {
              try {
                await registerUser(values);
                navigation.navigate('MainTabs');
              } catch (error) {
                setStatus(error?.message || 'Unable to create your account. Please try again.');
              }
            }}
          >
            {({ values, handleChange, handleBlur, handleSubmit, errors, touched, status, isSubmitting }) => (
              <View>
                <FormInput
                  label="First Name"
                  placeholder="Enter first name"
                  value={values.firstName}
                  onChangeText={handleChange('firstName')}
                  onBlur={handleBlur('firstName')}
                  error={touched.firstName && errors.firstName}
                />
                <FormInput
                  label="Last Name"
                  placeholder="Enter last name"
                  value={values.lastName}
                  onChangeText={handleChange('lastName')}
                  onBlur={handleBlur('lastName')}
                  error={touched.lastName && errors.lastName}
                />
                <FormInput
                  label="Email Address"
                  placeholder="example@gmail.com"
                  value={values.email}
                  onChangeText={handleChange('email')}
                  onBlur={handleBlur('email')}
                  keyboardType="email-address"
                  error={touched.email && errors.email}
                />
                <FormInput
                  label="Password"
                  placeholder="Minimum 8 characters"
                  value={values.password}
                  onChangeText={handleChange('password')}
                  onBlur={handleBlur('password')}
                  secureTextEntry
                  error={touched.password && errors.password}
                  helperText={values.password ? `Password Strength: ${getPasswordStrength(values.password)}` : ''}
                />
                <FormInput
                  label="Confirm Password"
                  placeholder="Re-enter password"
                  value={values.confirmPassword}
                  onChangeText={handleChange('confirmPassword')}
                  onBlur={handleBlur('confirmPassword')}
                  secureTextEntry
                  error={touched.confirmPassword && errors.confirmPassword}
                />
                <FormInput
                  label="Phone Number"
                  placeholder="09XXXXXXXXX"
                  value={values.phoneNumber}
                  onChangeText={handleChange('phoneNumber')}
                  onBlur={handleBlur('phoneNumber')}
                  keyboardType="phone-pad"
                  numericOnly
                  error={touched.phoneNumber && errors.phoneNumber}
                />

                {status ? <Text style={styles.statusText}>{status}</Text> : null}
                <PrimaryButton title={isSubmitting ? 'Creating account…' : 'Create Account'} onPress={handleSubmit} disabled={isSubmitting} style={styles.buttonSpacing} />
              </View>
            )}
          </Formik>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    padding: SPACING.lg,
    paddingTop: 42,
    minHeight: '100%',
  },
  backIconWrap: Platform.select({
    web: {
      width: 44,
      height: 44,
      borderRadius: RADII.control,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
      boxShadow: '0px 6px 18px rgba(22, 116, 209, 0.14)',
    },
    default: {
      width: 44,
      height: 44,
      borderRadius: RADII.control,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
      shadowColor: COLORS.primary,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 14,
      elevation: 4,
    },
  }),
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.hero,
    padding: SPACING.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heading: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.navy,
  },
  subheading: {
    fontSize: 15,
    color: COLORS.muted,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  buttonSpacing: {
    marginBottom: SPACING.sm,
  },
  statusText: {
    color: COLORS.danger,
    fontSize: 13,
    marginBottom: 10,
  },
});
