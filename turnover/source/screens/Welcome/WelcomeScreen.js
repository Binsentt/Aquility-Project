import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import LogoMark from '../../components/Logo/LogoMark';
import PrimaryButton from '../../components/Button/PrimaryButton';
import { COLORS, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function WelcomeScreen() {
  const navigation = useNavigation();

  return (
    <LinearGradient colors={['#F8FCFF', '#EAF8FD', '#D8F3FF']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={[styles.heroCard, SHADOWS.strong]}>
            <LogoMark showLabel={false} size={104} />
            <Text style={styles.appTitle}>AQUALITY</Text>
            <Text style={styles.heroTitle}>Smart Water Quality Monitoring with µPAD Technology</Text>
            <Text style={styles.heroSubtitle}>
              AQUALITY uses Microfluidic Paper-based Analytical Devices (µPADs) and your phone’s camera to estimate pH and nitrite from color references that still require experimental validation.
            </Text>
          </View>
        </View>

        <View style={[styles.featureCard, SHADOWS.card]}>
          <Text style={styles.cardHeading}>What AQUALITY does</Text>
          <Text style={styles.infoText}>Users can scan a colorimetric µPAD, view the water-quality results, save the test location using GPS, and visualize collected water-quality data through an interactive GIS map.</Text>
          <Text style={styles.infoText}>It is designed as a simple, portable, accessible, and low-cost water-quality monitoring tool for students, researchers, and communities.</Text>
        </View>

        <View style={[styles.actionCard, SHADOWS.card]}>
          <Text style={styles.cardHeading}>Get started</Text>
          <Text style={styles.cardNote}>Pick your preferred entry point and continue with the shared AQUALITY workflow.</Text>
          <PrimaryButton title="Login" onPress={() => navigation.navigate('Login')} style={styles.buttonSpacing} />
          <PrimaryButton title="Create Account" onPress={() => navigation.navigate('Register')} style={styles.buttonSpacing} />
          <PrimaryButton title="Continue as Guest" onPress={() => navigation.navigate('GuestInfo')} />
        </View>

        <View style={[styles.featureCard, SHADOWS.card]}>
          <Text style={styles.cardHeading}>Key features</Text>
          <Text style={styles.featureItem}>• Scan µPADs easily using the smartphone camera.</Text>
          <Text style={styles.featureItem}>• Estimate pH and nitrite from the color response.</Text>
          <Text style={styles.featureItem}>• View water-quality results and a simple assessment after each scan.</Text>
          <Text style={styles.featureItem}>• Save GPS locations and monitor tested water sources through GIS.</Text>
          <Text style={styles.featureItem}>• Support low-cost, portable water-quality monitoring in the field.</Text>
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
    padding: SPACING.xl,
    paddingTop: 48,
    alignItems: 'center',
    minHeight: '100%',
  },
  heroSection: {
    width: '100%',
    marginBottom: SPACING.xxl,
  },
  heroCard: {
    width: '100%',
    borderRadius: RADII.hero,
    padding: SPACING.xxl,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  appTitle: {
    marginTop: SPACING.md,
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.navy,
  },
  heroTitle: {
    marginTop: SPACING.sm,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 30,
  },
  heroSubtitle: {
    marginTop: SPACING.sm,
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
  },
  featureCard: {
    width: '100%',
    borderRadius: RADII.hero,
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
  },
  actionCard: {
    width: '100%',
    borderRadius: RADII.hero,
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
  },
  cardHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.navy,
    marginBottom: SPACING.xs,
  },
  cardNote: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  infoText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  featureItem: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  buttonSpacing: {
    marginBottom: SPACING.sm,
  },
});
