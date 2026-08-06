import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import LogoMark from '../../components/Logo/LogoMark';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { currentUser, logout } = useAuth();
  const isGuest = Boolean(currentUser?.isGuest);
  const fullName = currentUser?.fullName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || (isGuest ? 'Guest User' : 'AQUILITY User');
  const email = currentUser?.email || 'Not provided';
  const phone = currentUser?.phoneNumber || currentUser?.contactNumber || 'Not provided';
  const address = [currentUser?.barangay, currentUser?.municipality].filter(Boolean).join(', ') || 'Not provided';
  const accountLabel = isGuest ? 'Guest account' : 'Registered account';

  const handleExit = async () => {
    await logout();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerCard, SHADOWS.strong]}>
          <View style={styles.profileBrand}>
            <LogoMark showLabel={false} size={42} />
            <Text style={styles.brandName}>AQUILITY</Text>
          </View>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name={isGuest ? 'account-group-outline' : 'account-circle'} size={94} color={COLORS.primary} />
          </View>
          <Text style={styles.userName}>{fullName}</Text>
          <Text style={styles.userRole}>{accountLabel}</Text>

          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <MaterialCommunityIcons name="shield-check" size={14} color={COLORS.success} />
              <Text style={styles.statusText}>Profile ready</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={styles.editText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoCard, SHADOWS.card]}>
          <Text style={styles.sectionTitle}>Account details</Text>
          <InfoRow label="Full name" value={fullName} icon="account" />
          <InfoRow label="Email" value={email} icon="email-outline" />
          <InfoRow label="Phone" value={phone} icon="phone-outline" />
          <InfoRow label="Address" value={address} icon="map-marker-radius-outline" />
          <InfoRow label="Account type" value={accountLabel} icon="badge-account" />
        </View>

        <View style={[styles.infoCard, SHADOWS.card]}>
          <Text style={styles.sectionTitle}>Quick access</Text>
          <TouchableOpacity style={styles.quickRow} onPress={() => navigation.navigate('PrivacyNotice')}>
            <MaterialCommunityIcons name="shield-lock-outline" size={18} color={COLORS.primary} />
            <Text style={styles.quickText}>Privacy notice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickRow} onPress={() => navigation.navigate('TermsOfUse')}>
            <MaterialCommunityIcons name="file-document-outline" size={18} color={COLORS.primary} />
            <Text style={styles.quickText}>Terms of use</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.logoutCard, SHADOWS.card]}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleExit}>
            <MaterialCommunityIcons name="logout" size={20} color={COLORS.danger} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, icon }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FBFF',
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    padding: LAYOUT.pagePadding,
    paddingTop: 52,
    paddingBottom: 110,
  },
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.hero,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  profileBrand: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  brandName: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  avatarWrap: {
    width: 116,
    height: 116,
    borderRadius: RADII.card,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    marginTop: SPACING.md,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.navy,
    textAlign: 'center',
  },
  userRole: {
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  statusRow: {
    marginTop: SPACING.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAFBF2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusText: {
    color: COLORS.success,
    fontWeight: '800',
    marginLeft: 6,
  },
  editButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADII.control,
    minHeight: SIZES.touchTarget,
    paddingVertical: 10,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  editText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: RADII.control,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    marginTop: 4,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  quickText: {
    marginLeft: 10,
    color: COLORS.text,
    fontWeight: '700',
  },
  logoutCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.lg,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  logoutText: {
    color: COLORS.danger,
    fontWeight: '800',
    marginLeft: 10,
  },
});
