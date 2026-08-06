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
            <Text style={styles.appTitle}>AQUILITY</Text>
            <Text style={styles.heroSubtitle}>
              Smart water quality monitoring for barangay communities, health workers, and environmental teams.
            </Text>
          </View>
        </View>

        <View style={[styles.actionCard, SHADOWS.card]}>
          <Text style={styles.cardHeading}>Get started</Text>
          <Text style={styles.cardNote}>Pick your preferred entry point and continue with the shared AQUILITY workflow.</Text>
          <PrimaryButton title="Login" onPress={() => navigation.navigate('Login')} style={styles.buttonSpacing} />
          <PrimaryButton title="Create Account" onPress={() => navigation.navigate('Register')} style={styles.buttonSpacing} />
          <PrimaryButton title="Continue as Guest" onPress={() => navigation.navigate('GuestInfo')} />
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
  heroSubtitle: {
    marginTop: SPACING.sm,
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  actionCard: {
    width: '100%',
    borderRadius: RADII.hero,
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
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
  buttonSpacing: {
    marginBottom: SPACING.sm,
  },
});
