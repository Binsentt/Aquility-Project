import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Formik } from 'formik';
import { useNavigation } from '@react-navigation/native';
import FormInput from '../../components/Input/FormInput';
import LogoMark from '../../components/Logo/LogoMark';
import PrimaryButton from '../../components/Button/PrimaryButton';
import { guestInfoValidationSchema } from '../../utils/validation';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function GuestInfoScreen() {
  const navigation = useNavigation();
  const { loginGuest } = useAuth();

  return (
    <LinearGradient colors={['#F8FCFF', '#EAF8FD', '#CFEFFF']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.goBack()} style={styles.backIconWrap}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.brandRow}>
            <LogoMark showLabel={false} size={54} />
            <View style={styles.brandCopy}>
              <Text style={styles.eyebrow}>AQUILITY</Text>
              <Text style={styles.heading}>Guest information</Text>
            </View>
          </View>
          <Text style={styles.subheading}>Continue without creating an account.</Text>

          <Formik
            initialValues={{ fullName: '', barangay: '', municipality: '', contactNumber: '' }}
            validationSchema={guestInfoValidationSchema}
            onSubmit={async (values, { setStatus }) => {
              try {
                await loginGuest(values);
                navigation.navigate('MainTabs');
              } catch (error) {
                setStatus(error?.message || 'Unable to start the guest session. Please try again.');
              }
            }}
          >
            {({ values, handleChange, handleBlur, handleSubmit, errors, touched, status, isSubmitting }) => (
              <View>
                <FormInput
                  label="Full Name"
                  placeholder="Enter full name"
                  value={values.fullName}
                  onChangeText={handleChange('fullName')}
                  onBlur={handleBlur('fullName')}
                  error={touched.fullName && errors.fullName}
                />
                <FormInput
                  label="Barangay"
                  placeholder="Enter barangay"
                  value={values.barangay}
                  onChangeText={handleChange('barangay')}
                  onBlur={handleBlur('barangay')}
                  error={touched.barangay && errors.barangay}
                />
                <FormInput
                  label="Municipality / City"
                  placeholder="Enter municipality or city"
                  value={values.municipality}
                  onChangeText={handleChange('municipality')}
                  onBlur={handleBlur('municipality')}
                  error={touched.municipality && errors.municipality}
                />
                <FormInput
                  label="Contact Number"
                  placeholder="09XXXXXXXXX"
                  value={values.contactNumber}
                  onChangeText={handleChange('contactNumber')}
                  onBlur={handleBlur('contactNumber')}
                  keyboardType="phone-pad"
                  numericOnly
                  error={touched.contactNumber && errors.contactNumber}
                />

                {status ? <Text style={styles.statusText}>{status}</Text> : null}
                <PrimaryButton title={isSubmitting ? 'Starting session…' : 'Continue'} onPress={handleSubmit} disabled={isSubmitting} style={styles.buttonSpacing} />
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
    justifyContent: 'center',
  },
  backIconWrap: {
    alignSelf: 'flex-start',
    width: 42,
    height: 42,
    borderRadius: RADII.control,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
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
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.navy,
  },
  subheading: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  buttonSpacing: {
    marginTop: 8,
  },
  statusText: {
    color: COLORS.danger,
    fontSize: 13,
    marginTop: 8,
  },
});
