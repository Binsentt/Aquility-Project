import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import LogoMark from '../../components/Logo/LogoMark';
import LoadingIndicator from '../../components/Loading/LoadingIndicator';
import { COLORS, SPACING } from '../../styles/theme';
import { useAuth } from '../../context/AuthContext';

export default function SplashScreen() {
  const navigation = useNavigation();
  const { authLoaded, currentUser } = useAuth();

  useEffect(() => {
    if (!authLoaded) return undefined;

    const timer = setTimeout(() => {
      navigation.replace(currentUser?.id ? 'MainTabs' : 'Welcome');
    }, 5000);

    return () => clearTimeout(timer);
  }, [authLoaded, currentUser?.id, navigation]);

  return (
    <LinearGradient colors={['#F7FDFF', '#DFF4FB', '#C7ECFC']} style={styles.container}>
      <LogoMark showLabel={false} size={126} />
      <Text style={styles.title}>AQUILITY</Text>
      <Text style={styles.tagline}>Water-quality testing for field teams and communities</Text>
      <View style={styles.loaderWrap}>
        <LoadingIndicator size={42} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  title: {
    marginTop: SPACING.md,
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1.4,
  },
  tagline: {
    marginTop: SPACING.sm,
    fontSize: 15,
    textAlign: 'center',
    color: COLORS.muted,
    maxWidth: 280,
  },
  loaderWrap: {
    marginTop: SPACING.xl,
  },
});
