import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import TopHeader from '../../components/Header/TopHeader';
import StatCard from '../../components/Card/StatCard';
import PrimaryButton from '../../components/Button/PrimaryButton';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { currentUser, scanHistory } = useAuth();
  const displayName = currentUser?.firstName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.fullName || 'AQUILITY User';

  const recentScans = scanHistory.slice(0, 3);
  const latestScan = scanHistory[0];
  const totalScans = scanHistory.length;
  const accountLabel = currentUser?.isGuest ? 'Guest session' : 'Registered account';

  return (
    <LinearGradient colors={['#F7FDFF', '#E9F6FF', '#EFF8FF']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TopHeader title="Welcome back" subtitle={`Hello, ${displayName}`} />

        <View style={[styles.heroCard, SHADOWS.strong]}>
          <View style={styles.heroTop}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroLabel}>Session overview</Text>
              <Text style={styles.heroScore}>{totalScans}</Text>
              <Text style={styles.heroStatus}>Saved scans</Text>
            </View>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="shield-check" size={18} color={COLORS.white} />
              <Text style={styles.heroBadgeText}>{accountLabel}</Text>
            </View>
          </View>

          <View style={styles.heroStats}>
            <StatCard title="Latest scan" value={latestScan ? latestScan.status : 'No scans yet'} style={styles.statCard} />
            <StatCard title="Last updated" value={latestScan ? new Date(latestScan.createdAt).toLocaleDateString() : '—'} style={styles.statCard} />
            <StatCard title="Analysis" value={latestScan ? latestScan.analysisStatus : 'Pending'} style={styles.statCard} />
          </View>

          <PrimaryButton title="Start Water Analysis" onPress={() => navigation.navigate('Scan')} style={styles.actionButton} />
        </View>

        <View style={[styles.sectionCard, SHADOWS.card]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent scans</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')} accessibilityRole="button" accessibilityLabel="Open water test history">
              <Text style={styles.sectionLink}>History</Text>
            </TouchableOpacity>
          </View>
          {recentScans.length ? (
            recentScans.map((item) => (
              <View key={item.id} style={styles.listRow}>
                <View style={styles.dot} />
                <View style={styles.listTextWrap}>
                  <Text style={styles.listTitle}>{item.title || 'Scan result'}</Text>
                  <Text style={styles.listDetail}>{item.status || 'Status pending'} · {new Date(item.createdAt).toLocaleString()}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No saved water tests yet. Capture or select a test strip to begin.</Text>
          )}
        </View>

        <View style={[styles.sectionCard, SHADOWS.card]}>
          <Text style={styles.sectionTitle}>Next steps</Text>
          <View style={styles.reportRow}>
            <MaterialCommunityIcons name="camera-outline" size={16} color={COLORS.primary} />
            <Text style={styles.reportText}>Capture a water-test strip image to create a new analysis.</Text>
          </View>
          <View style={styles.reportRow}>
            <MaterialCommunityIcons name="history" size={16} color={COLORS.primary} />
            <Text style={styles.reportText}>Review your saved results and export them from History.</Text>
          </View>
          <View style={styles.reportRow}>
            <MaterialCommunityIcons name="shield-account-outline" size={16} color={COLORS.primary} />
            <Text style={styles.reportText}>Keep your profile current so your guest or registered details stay consistent.</Text>
          </View>
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
    paddingHorizontal: LAYOUT.pagePadding,
    paddingTop: SPACING.lg,
    paddingBottom: LAYOUT.bottomTabClearance,
  },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.hero,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroLabel: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  heroScore: {
    color: COLORS.navy,
    fontSize: 38,
    fontWeight: '900',
    marginTop: SPACING.sm,
    lineHeight: 44,
  },
  heroStatus: {
    marginTop: SPACING.sm,
    color: COLORS.success,
    fontSize: 15,
    fontWeight: '800',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADII.pill,
    maxWidth: '56%',
  },
  heroBadgeText: {
    marginLeft: 8,
    color: COLORS.white,
    fontWeight: '800',
    flexShrink: 1,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    width: '100%',
    marginBottom: SPACING.lg,
    gap: SPACING.xs,
  },
  statCard: {
    width: '31%',
    minWidth: 0,
    marginBottom: SPACING.xs,
  },
  actionButton: {
    marginTop: SPACING.md,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginTop: 8,
    marginRight: 12,
  },
  listTextWrap: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  listDetail: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 20,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  reportText: {
    flex: 1,
    marginLeft: 10,
    color: COLORS.text,
    lineHeight: 22,
  },
  emptyText: {
    color: COLORS.muted,
    lineHeight: 20,
  },
});
