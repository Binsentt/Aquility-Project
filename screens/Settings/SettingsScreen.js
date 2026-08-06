import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// camera/location are handled in the Application subpage
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import LogoMark from '../../components/Logo/LogoMark';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { currentUser, logout, deleteAccount } = useAuth();
  const isGuest = currentUser?.isGuest;
  const displayName = isGuest
    ? currentUser?.fullName || 'Guest User'
    : currentUser?.fullName || `${currentUser?.firstName || 'AQUILITY'} ${currentUser?.lastName || 'User'}`;
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmType, setConfirmType] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const isDeleteAccount = confirmType === 'delete-account';

  const handleCancel = () => {
    if (actionBusy) return;
    setConfirmVisible(false);
    setConfirmType('');
    setDeletePassword('');
  };

  const showConfirm = (type) => {
    setConfirmType(type);
    setDeletePassword('');
    setConfirmVisible(true);
  };

  const handleConfirm = async () => {
    if (actionBusy) return;
    if (confirmType === 'logout') {
      setActionBusy(true);
      setConfirmVisible(false);
      setConfirmType('');
      try {
        await logout();
      } catch (error) {
        setActionBusy(false);
        Alert.alert('Logout failed', error?.message || 'Unable to close your session right now.');
      }
      return;
    }

    if (isDeleteAccount) {
      if (!isGuest && !deletePassword.trim()) {
        Alert.alert('Current password required', 'Enter your current password to permanently delete your account.');
        return;
      }
      try {
        setActionBusy(true);
        await deleteAccount(isGuest ? null : deletePassword);
        Alert.alert('Account deleted', 'Your account has been permanently deleted.');
      } catch (error) {
        setActionBusy(false);
        Alert.alert('Delete failed', error?.message || 'Unable to delete your account. Please try again.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Settings</Text>
          <LogoMark showLabel={false} size={44} />
        </View>
        <Text style={styles.subtitle}>Manage your account, privacy, and water-quality testing preferences.</Text>

        <View style={[styles.section, SHADOWS.strong]}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.categoryRow} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.85}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="account-circle-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.rowLabel}>Edit Profile</Text>
                <Text style={styles.rowSubtitle}>{displayName}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.border} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, styles.accountManagementSection, SHADOWS.strong]}>
          <Text style={styles.sectionTitle}>Account Management</Text>
          <TouchableOpacity style={styles.deleteAccountRow} onPress={() => showConfirm('delete-account')} activeOpacity={0.85}>
            <View style={styles.rowLeft}>
              <View style={styles.logoutIconWrap}>
                <MaterialCommunityIcons name="delete-alert-outline" size={20} color={COLORS.danger} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.logoutText}>Delete Account</Text>
                <Text style={styles.rowSubtitle}>Permanently remove your profile and water-test records</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, SHADOWS.strong]}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <TouchableOpacity style={styles.categoryRow} onPress={() => Alert.alert('Language', 'English is currently selected for AQUILITY.')} activeOpacity={0.85}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="translate" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.rowLabel}>Language</Text>
                <Text style={styles.rowSubtitle}>English</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.border} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryRow} onPress={() => navigation.navigate('SettingsApplication')} activeOpacity={0.85}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.rowLabel}>Location Permission</Text>
                <Text style={styles.rowSubtitle}>Camera, photo, and location access</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.border} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, SHADOWS.strong]}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity style={styles.categoryRow} onPress={() => navigation.navigate('HelpGuide')} activeOpacity={0.85}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="help-circle-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.rowLabel}>Help / Guide</Text>
                <Text style={styles.rowSubtitle}>How to scan, save, and use AQUILITY</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.border} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, SHADOWS.strong]}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <TouchableOpacity style={styles.categoryRow} onPress={() => navigation.navigate('PrivacyNotice')} activeOpacity={0.85}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="shield-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.rowLabel}>Privacy Notice</Text>
                <Text style={styles.rowSubtitle}>How your profile and offline cache are handled</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.border} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryRow} onPress={() => navigation.navigate('TermsOfUse')} activeOpacity={0.85}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="file-document-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.rowLabel}>Terms of Use</Text>
                <Text style={styles.rowSubtitle}>Intended use and limitations</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.border} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryRow} onPress={() => navigation.navigate('SettingsAbout')} activeOpacity={0.85}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="information-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.rowLabel}>About</Text>
                <Text style={styles.rowSubtitle}>Version and app information</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.border} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, styles.logoutSection, SHADOWS.strong]}>
          <TouchableOpacity style={styles.logoutRow} activeOpacity={0.8} onPress={() => showConfirm('logout')}>
            <View style={styles.rowLeft}>
              <View style={styles.logoutIconWrap}>
                <MaterialCommunityIcons name="logout" size={18} color={COLORS.danger} />
              </View>
              <Text style={styles.logoutText}>Logout</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.border} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal transparent visible={confirmVisible} animationType="fade" onRequestClose={handleCancel}>
        <View style={styles.modalBack}>
          <View style={[styles.modalCard, SHADOWS.strong]}>
            <Text style={styles.modalTitle}>{isDeleteAccount ? 'Delete Account' : 'Confirm Logout'}</Text>
            <Text style={styles.modalText}>
              {isDeleteAccount
                ? 'Are you sure you want to permanently delete your account? This action cannot be undone. Your profile, scan history, uploaded images, and associated records will be permanently removed.'
                : 'Are you sure you want to logout from AQUILITY? You will return to the welcome screen.'}
            </Text>
            {isDeleteAccount && !isGuest ? (
              <TextInput
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Current password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                editable={!actionBusy}
                style={styles.passwordInput}
              />
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalAction} onPress={handleCancel} disabled={actionBusy}>
                <Text style={styles.modalActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalAction, isDeleteAccount ? styles.dangerModalAction : styles.primaryModalAction, actionBusy && styles.disabledAction]} onPress={handleConfirm} disabled={actionBusy}>
                <Text style={[styles.modalActionText, styles.primaryActionText]}>{actionBusy ? 'Please wait…' : isDeleteAccount ? 'Delete Permanently' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: SPACING.xl,
    paddingTop: 54,
    paddingBottom: LAYOUT.bottomTabClearance,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.navy,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: SPACING.md,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontWeight: '900',
    color: COLORS.navy,
    fontSize: 16,
    marginBottom: SPACING.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: SIZES.touchTarget + 8,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textBlock: {
    flex: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADII.control,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  rowLabel: {
    color: COLORS.navy,
    fontWeight: '800',
    fontSize: 15,
  },
  rowSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  logoutSection: {
    borderWidth: 1,
    borderColor: '#F6D8D8',
  },
  accountManagementSection: {
    borderWidth: 1,
    borderColor: '#F6D8D8',
  },
  deleteAccountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: SIZES.touchTarget + 8,
    paddingVertical: SPACING.sm,
  },
  logoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: SIZES.touchTarget,
    paddingVertical: 8,
  },
  logoutIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADII.control,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  logoutText: {
    color: COLORS.danger,
    fontWeight: '900',
    fontSize: 15,
  },
  modalBack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 39, 68, 0.45)',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.lg,
  },
  modalTitle: {
    color: COLORS.navy,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  modalText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  passwordInput: {
    minHeight: SIZES.touchTarget,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.control,
    paddingHorizontal: SPACING.sm,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalAction: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.soft,
    marginLeft: 10,
  },
  modalActionText: {
    color: COLORS.navy,
    fontWeight: '700',
  },
  primaryModalAction: {
    backgroundColor: COLORS.primary,
  },
  dangerModalAction: {
    backgroundColor: COLORS.danger,
  },
  disabledAction: {
    opacity: 0.65,
  },
  primaryActionText: {
    color: COLORS.white,
  },
});
