import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import LogoMark from '../../components/Logo/LogoMark';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function ProfileSettings() {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const isGuest = currentUser?.isGuest;

  const address = [currentUser?.address, currentUser?.barangay, currentUser?.municipality]
    .filter(Boolean)
    .join(', ');

  const role = currentUser?.role || (isGuest ? 'Guest' : 'Registered User');

  const handleEdit = () => {
    navigation.navigate('EditProfile');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <LogoMark showLabel={false} size={34} />
      </View>

      <View style={[styles.card, SHADOWS.strong]}>
        <View style={styles.topRow}>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name={isGuest ? 'account-group-outline' : 'account-circle'} size={54} color={COLORS.primary} />
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{currentUser?.fullName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim()}</Text>
            <Text style={styles.roleText}>{role}</Text>
          </View>
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Text style={styles.fieldValue}>{currentUser?.email || 'Not provided'}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Phone Number</Text>
          <Text style={styles.fieldValue}>{currentUser?.phoneNumber || 'Not provided'}</Text>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Address</Text>
          <Text style={styles.fieldValue}>{address || 'Not provided'}</Text>
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={handleEdit} activeOpacity={0.85}>
          <MaterialCommunityIcons name="account-edit-outline" size={18} color={COLORS.white} />
          <Text style={styles.actionText}>Edit Profile</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBFF', padding: LAYOUT.pagePadding, maxWidth: SIZES.contentMaxWidth, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: COLORS.white, borderRadius: RADII.card, padding: SPACING.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarWrap: { width: 76, height: 76, borderRadius: RADII.card, backgroundColor: COLORS.soft, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  info: { flex: 1 },
  name: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
  meta: { color: COLORS.muted, marginTop: 4 },
  fieldRow: { marginTop: 12 },
  fieldLabel: { color: COLORS.muted, fontSize: 12 },
  fieldValue: { color: COLORS.text, fontWeight: '700', marginTop: 4 },
  actionButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: RADII.control,
    minHeight: SIZES.touchTarget,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: COLORS.white, marginLeft: 8, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.navy,
  },
  roleText: {
    marginTop: 6,
    color: COLORS.primary,
    fontWeight: '700',
  },
});
