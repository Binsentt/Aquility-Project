import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Formik } from 'formik';
import * as Yup from 'yup';
import FormInput from '../../components/Input/FormInput';
import LogoMark from '../../components/Logo/LogoMark';
import PrimaryButton from '../../components/Button/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

const editProfileValidationSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Enter a valid email address'),
  phoneNumber: Yup.string().matches(/^[0-9]{10,13}$/, 'Enter a valid phone number', {
    excludeEmptyString: true,
  }),
  barangay: Yup.string().optional(),
  municipality: Yup.string().optional(),
});

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { currentUser, updateUserProfile } = useAuth();
  const isGuest = currentUser?.isGuest;
  const [saving, setSaving] = useState(false);

  const initialValues = {
    firstName: currentUser?.firstName || currentUser?.fullName?.split(' ')[0] || '',
    lastName: currentUser?.lastName || currentUser?.fullName?.split(' ').slice(1).join(' ') || '',
    email: currentUser?.email || '',
    phoneNumber: currentUser?.phoneNumber || '',
    barangay: currentUser?.barangay || '',
    municipality: currentUser?.municipality || '',
  };

  const { addNotification } = useAuth();

  const handleSubmit = async (values) => {
    if (saving) return;
    try {
      setSaving(true);
      await updateUserProfile(values);
      addNotification('Profile Updated', 'Your profile has been updated successfully.');
      Alert.alert('Profile Updated', 'Your profile information has been saved.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Profile update failed', error?.message || 'Unable to save your profile right now.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigation.goBack();
    }
  }, [currentUser, navigation]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Edit Profile</Text>
        <LogoMark showLabel={false} size={36} />
      </View>

      <View style={[styles.card, SHADOWS.strong]}>
        <Text style={styles.cardTitle}>Personal Information</Text>
        <Text style={styles.cardSubtitle}>Update your profile details and contact information.</Text>

        <Formik
          initialValues={initialValues}
          validationSchema={editProfileValidationSchema}
          onSubmit={handleSubmit}
        >
          {({ values, handleChange, handleBlur, handleSubmit, errors, touched }) => (
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
                label="Phone Number"
                placeholder="09XXXXXXXXX"
                value={values.phoneNumber}
                onChangeText={handleChange('phoneNumber')}
                onBlur={handleBlur('phoneNumber')}
                keyboardType="phone-pad"
                numericOnly
                error={touched.phoneNumber && errors.phoneNumber}
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
                label="Email"
                placeholder="Enter email address"
                value={values.email}
                onChangeText={handleChange('email')}
                onBlur={handleBlur('email')}
                keyboardType="email-address"
                error={touched.email && errors.email}
              />

              <PrimaryButton title={saving ? 'Saving…' : 'Save Changes'} onPress={handleSubmit} disabled={saving} style={styles.saveButton} />
            </View>
          )}
        </Formik>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    padding: LAYOUT.pagePadding,
    paddingTop: 42,
    paddingBottom: 90,
    backgroundColor: '#F7FBFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  backButton: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    borderRadius: RADII.control,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  screenTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.navy,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.hero,
    padding: SPACING.lg,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.navy,
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: SPACING.md,
  },
  saveButton: {
    marginTop: SPACING.md,
  },
});
