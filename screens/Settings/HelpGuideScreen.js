import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LogoMark from '../../components/Logo/LogoMark';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

const guideSteps = [
  {
    title: '1. Get started',
    text: 'Open the Scan tab to begin. The screen is meant to stay focused on camera capture and review without the bottom navigation covering the controls.',
    icon: 'play-circle-outline',
  },
  {
    title: '2. Capture a clear image',
    text: 'Center the water-test strip in the guide, then tap Capture. The Gallery button lets you bring in a photo from your device as well.',
    icon: 'camera-outline',
  },
  {
    title: '3. Review before you analyze',
    text: 'Use the thumbnail strip and the review sheet to inspect each photo. Remove a poor image and capture another one before you continue.',
    icon: 'image-multiple-outline',
  },
  {
    title: '4. Use Auto or Manual mode',
    text: 'Auto mode uses assisted capture guidance while Manual mode lets you capture whenever you are ready. The app does not claim to provide certified lab measurements.',
    icon: 'auto-fix',
  },
  {
    title: '5. Analyze and save the result',
    text: 'Tap Analyze to save a water-test record. The app preserves the image, metadata, and location when permission is granted.',
    icon: 'chart-line',
  },
  {
    title: '6. Review results and history',
    text: 'Each completed scan is stored in History so you can return to it later. Open the result or history detail screen to review the summary and export options.',
    icon: 'history',
  },
  {
    title: '7. Use the map',
    text: 'If location permission is granted, saved scans can show their real coordinates on the map. The full map shows anonymous marker status and location context from the current backend feed.',
    icon: 'map-marker-radius-outline',
  },
  {
    title: '8. Export a report',
    text: 'From the result and history views, you can create a local PDF or PNG export and share it from your device. Files are kept in the app storage area when supported.',
    icon: 'export-variant',
  },
];

const tips = [
  'Use good lighting and keep the subject flat for the best capture quality.',
  'If location access is granted, AQUILITY can attach the current place to a saved scan.',
  'Camera, gallery, and location permissions can be managed from Settings.',
  'Results use the current mock analysis settings until approved calibration data and formulas are supplied.',
  'If a permission or export step fails, check the current device settings and retry.',
];

export default function HelpGuideScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Help & Guide</Text>
          <Text style={styles.headerSubtitle}>Quick tips for using AQUILITY confidently.</Text>
        </View>
        <LogoMark showLabel={false} size={34} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, SHADOWS.strong]}>
          <Text style={styles.heroTitle}>How AQUILITY works</Text>
          <Text style={styles.heroText}>
            Capture a photo, review it, and use the result screen to understand what is available in the current app setup.
          </Text>
        </View>

        {guideSteps.map((step) => (
          <View key={step.title} style={[styles.card, SHADOWS.strong]}>
            <View style={styles.cardIconWrap}>
              <MaterialCommunityIcons name={step.icon} size={20} color={COLORS.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{step.title}</Text>
              <Text style={styles.cardText}>{step.text}</Text>
            </View>
          </View>
        ))}

        <View style={[styles.card, SHADOWS.strong]}>
          <Text style={styles.cardTitle}>Helpful tips</Text>
          {tips.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <MaterialCommunityIcons name="check-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FBFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.pagePadding,
    paddingTop: 48,
    paddingBottom: 12,
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
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.navy,
  },
  headerSubtitle: {
    marginTop: 2,
    color: COLORS.muted,
    fontSize: 13,
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    padding: LAYOUT.pagePadding,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.navy,
    marginBottom: SPACING.xs,
  },
  heroText: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADII.control,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 4,
  },
  cardText: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 20,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  tipText: {
    flex: 1,
    marginLeft: 8,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
  },
});
