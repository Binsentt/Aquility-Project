import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LogoMark from '../../components/Logo/LogoMark';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';
import Constants from 'expo-constants';

export default function AboutSettings() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <LogoMark showLabel={false} size={34} />
      </View>

      <View style={[styles.card, SHADOWS.strong]}>
        <LogoMark showLabel={false} size={68} />
        <Text style={styles.title}>AQUALITY</Text>
        <Text style={styles.subtitle}>Smart Water Quality Monitoring with µPAD Technology.</Text>

        <View style={styles.infoBlock}>
          <Text style={styles.sectionTitle}>About AQUALITY</Text>
          <Text style={styles.infoText}>AQUALITY uses Microfluidic Paper-based Analytical Devices (µPADs) and the phone camera to estimate pH and nitrite from client-provided color references that require experimental validation.</Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <Text style={styles.infoText}>µPAD → Smartphone Camera → ROI Color Analysis → pH + Nitrite Estimates → GPS Storage → GIS Map</Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.sectionTitle}>Designed for</Text>
          <Text style={styles.infoText}>Students, researchers, and communities who need a simple, portable, and low-cost way to monitor water quality.</Text>
        </View>

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('PrivacyNotice')}>
          <Text style={styles.rowLabel}>Privacy Notice</Text>
          <Text style={styles.rowLink}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('TermsOfUse')}>
          <Text style={styles.rowLabel}>Terms of Use</Text>
          <Text style={styles.rowLink}>View</Text>
        </TouchableOpacity>

        <View style={styles.rowSmall}>
          <Text style={styles.rowLabel}>App Version</Text>
          <Text style={styles.rowValue}>{Constants.manifest?.version || Constants.expoConfig?.version || '1.0.0'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBFF' },
  content: { width: '100%', maxWidth: SIZES.contentMaxWidth, alignSelf: 'center', padding: LAYOUT.pagePadding, paddingBottom: 90 },
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
  card: { backgroundColor: COLORS.white, borderRadius: RADII.card, padding: SPACING.lg },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.navy, marginTop: SPACING.sm },
  subtitle: { color: COLORS.muted, marginTop: SPACING.xs, marginBottom: SPACING.sm },
  infoBlock: { marginBottom: SPACING.md },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.navy, marginBottom: SPACING.xs },
  infoText: { color: COLORS.muted, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: SIZES.touchTarget, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.soft },
  rowLabel: { color: COLORS.text, fontWeight: '800' },
  rowLink: { color: COLORS.primary, fontWeight: '800' },
  rowSmall: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.sm, alignSelf: 'stretch' },
  rowValue: { fontWeight: '800', color: COLORS.text },
});
