import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import LogoMark from '../../components/Logo/LogoMark';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function ApplicationSettings() {
  const navigation = useNavigation();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraStatus, setCameraStatus] = useState('unknown');
  const [photoStatus, setPhotoStatus] = useState('unknown');
  const [locationStatus, setLocationStatus] = useState('unknown');

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const [mediaPermission, locationPermission] = await Promise.all([
          ImagePicker.getMediaLibraryPermissionsAsync(),
          Location.getForegroundPermissionsAsync(),
        ]);
        if (isMounted) {
          setCameraStatus(cameraPermission?.status || 'unknown');
          setPhotoStatus(mediaPermission.status);
          setLocationStatus(locationPermission.status);
        }
      } catch {
        if (isMounted) {
          setPhotoStatus('unknown');
          setLocationStatus('unknown');
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [cameraPermission]);

  const handleCameraPermissionRequest = async () => {
    try {
      const result = await requestCameraPermission();
      if (result?.status) {
        setCameraStatus(result.status);
      }
    } catch {
      Alert.alert('Camera permission unavailable', 'AQUILITY could not request camera access. Please try again.');
    }
  };

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      try {
        const fallbackUrl = 'app-settings:';
        const supported = await Linking.canOpenURL(fallbackUrl);
        if (supported) {
          await Linking.openURL(fallbackUrl);
          return;
        }
      } catch {}

      Alert.alert(
        'Unable to open settings',
        'Please open your device settings manually.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Application</Text>
        <LogoMark showLabel={false} size={34} />
      </View>
      <View style={[styles.card, SHADOWS.strong]}>
        <Text style={styles.title}>Application</Text>
        <Text style={styles.subtitle}>Permissions and version control.</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Camera Permission</Text>
          <Text style={styles.value}>{cameraStatus === 'granted' ? 'Granted' : cameraStatus === 'denied' ? 'Denied' : 'Unknown'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Photo Permission</Text>
          <Text style={styles.value}>{photoStatus === 'granted' ? 'Granted' : photoStatus === 'denied' ? 'Denied' : 'Unknown'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Location Permission</Text>
          <Text style={styles.value}>{locationStatus === 'granted' ? 'Granted' : locationStatus === 'denied' ? 'Denied' : 'Unknown'}</Text>
        </View>

        {(cameraStatus === 'denied' || photoStatus === 'denied' || locationStatus === 'denied') ? (
          <TouchableOpacity style={styles.open} onPress={openSettings} activeOpacity={0.85}>
            <Text style={styles.openText}>Open App Settings</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.rowSmall}>
          <Text style={styles.label}>App Version</Text>
          <Text style={styles.value}>{Constants.manifest?.version || Constants.expoConfig?.version || '1.0.0'}</Text>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBFF', padding: LAYOUT.pagePadding, maxWidth: SIZES.contentMaxWidth, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: COLORS.white, borderRadius: RADII.card, padding: SPACING.lg },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
  subtitle: { color: COLORS.muted, marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', minHeight: SIZES.touchTarget, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.soft },
  rowSmall: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.sm },
  label: { color: COLORS.muted },
  value: { fontWeight: '800', color: COLORS.text },
  open: { marginTop: SPACING.sm, minHeight: SIZES.touchTarget, backgroundColor: COLORS.secondary, padding: SPACING.sm, borderRadius: RADII.control, alignItems: 'center', justifyContent: 'center' },
  openText: { color: COLORS.white, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
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
});
