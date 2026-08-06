import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import LogoMark from '../../components/Logo/LogoMark';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function PrivacyNoticeScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Notice</Text>
        <LogoMark showLabel={false} size={34} />
      </View>

      <View style={[styles.card, SHADOWS.strong]}>
        <Text style={styles.title}>AQUILITY Privacy Notice</Text>
        <Text style={styles.paragraph}>
          AQUILITY is a mobile application for recording water-quality tests, organizing water-test records, and sharing report summaries. The app supports a practical water-quality testing workflow for field and community use.
        </Text>
        <Text style={styles.paragraph}>
          The AQUILITY service stores information you provide in your profile, including your name, email, phone number, barangay, municipality, and other contact details. Registered and active guest accounts use this information to associate water-test records with the correct account. A limited offline cache may remain on your device to support temporary offline use.
        </Text>
        <Text style={styles.paragraph}>
          Captured test-strip images, selected gallery photos, water-test history, and report metadata are stored with their water-test record to support review, export, and history browsing. The offline cache is only a fallback and is not the source of truth for your account or saved results.
        </Text>
        <Text style={styles.paragraph}>
          Camera and photo permissions are requested only when needed for scanning or selecting a water-test strip image. Water-analysis results use the current backend and mock calibration settings until approved laboratory formulas and reference data are supplied.
        </Text>
        <Text style={styles.paragraph}>
          The app uses local device storage and the existing Expo-compatible file system to save exports where supported. Please avoid uploading sensitive personal or location information unless you are comfortable storing it with your water-test record and on your device when an offline cache or export is created.
        </Text>
        <Text style={styles.paragraph}>
          You can review or update your stored profile information from the profile screen. If you need support, contact the application provider. This notice may be updated as the app evolves.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBFF' },
  content: { width: '100%', maxWidth: SIZES.contentMaxWidth, alignSelf: 'center', padding: LAYOUT.pagePadding, paddingBottom: 90 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: COLORS.navy },
  card: { backgroundColor: COLORS.white, borderRadius: RADII.card, padding: SPACING.lg },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.navy, marginBottom: SPACING.sm },
  paragraph: { color: COLORS.text, fontSize: 14, lineHeight: 22, marginBottom: SPACING.sm },
});
