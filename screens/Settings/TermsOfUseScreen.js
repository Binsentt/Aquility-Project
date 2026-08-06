import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import LogoMark from '../../components/Logo/LogoMark';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function TermsOfUseScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Use</Text>
        <LogoMark showLabel={false} size={34} />
      </View>

      <View style={[styles.card, SHADOWS.strong]}>
        <Text style={styles.title}>AQUILITY Terms of Use</Text>
        <Text style={styles.paragraph}>
          AQUILITY is provided for informational water-quality testing assistance. You are responsible for using the app in a lawful and respectful manner.
        </Text>
        <Text style={styles.paragraph}>
          Users must provide accurate account information when registering or updating their profile. Camera and gallery access are intended for water-test strip capture and image selection. You are responsible for ensuring that you have permission to scan or upload any water-test image you use within the app.
        </Text>
        <Text style={styles.paragraph}>
          Water-quality results shown in the app are informational only. AQUILITY does not guarantee laboratory-grade analytical accuracy unless a genuine, verified measurement backend or qualified service is explicitly integrated. Any interpretation of results should be done with appropriate caution and professional judgment.
        </Text>
        <Text style={styles.paragraph}>
          The app may display generated report data, scan history, and export features for local review. You should not rely on these outputs as a substitute for official testing or certified water-quality analysis where required.
        </Text>
        <Text style={styles.paragraph}>
          The application, its UI, water-test workflow, and generated reports are for personal and operational use. You may not misuse the app to violate privacy rights, store prohibited content, or cause disruptions to service availability.
        </Text>
        <Text style={styles.paragraph}>
          The app may be updated over time. Continued use of AQUILITY after updates means you accept the current terms and any new policies. The provider is not liable for damages arising from inaccurate user-provided data, unsupported third-party integrations, or use of the app outside its intended purpose.
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
