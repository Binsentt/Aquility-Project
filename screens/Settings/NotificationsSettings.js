import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import LogoMark from '../../components/Logo/LogoMark';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';

export default function NotificationsSettings() {
  const navigation = useNavigation();
  const { notifications, markAllNotificationsRead, clearNotifications } = useAuth();

  const unreadCount = notifications.filter((item) => item.unread).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <LogoMark showLabel={false} size={34} />
      </View>
      <View style={[styles.card, SHADOWS.strong]}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>Recent alerts and activity from AQUILITY.</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.smallButton} onPress={markAllNotificationsRead} activeOpacity={0.8}>
            <Text style={styles.smallButtonText}>Mark All as Read</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallButton, styles.secondaryButton]} onPress={clearNotifications} activeOpacity={0.8}>
            <Text style={[styles.smallButtonText, styles.secondaryButtonText]}>Clear Notifications</Text>
          </TouchableOpacity>
        </View>

        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="bell-off-outline" size={40} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>Your alerts will appear here as you use the app.</Text>
          </View>
        ) : (
          notifications.map((item) => (
            <View key={item.id} style={[styles.notificationCard, item.unread ? styles.unreadCard : null]}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                {item.unread ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.notificationDetail}>{item.detail}</Text>
              <Text style={styles.notificationTime}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
          ))
        )}

        {notifications.length > 0 ? (
          <Text style={styles.statusText}>{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBFF', padding: LAYOUT.pagePadding, maxWidth: SIZES.contentMaxWidth, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: COLORS.white, borderRadius: RADII.card, padding: SPACING.lg },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
  subtitle: { color: COLORS.muted, marginTop: 6 },
  preferences: { marginTop: 18 },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.soft },
  preferenceText: { flex: 1, paddingRight: 12 },
  preferenceLabel: { color: COLORS.navy, fontWeight: '800', fontSize: 14 },
  preferenceSub: { color: COLORS.muted, marginTop: 4, fontSize: 12, lineHeight: 18 },
  list: { marginTop: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  rowText: { color: COLORS.text },
  rowTime: { color: COLORS.muted },
  actionButton: { marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actionText: { color: COLORS.white, marginLeft: 8, fontWeight: '800' },
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
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  smallButton: {
    flex: 1,
    minHeight: SIZES.touchTarget,
    paddingVertical: 10,
    borderRadius: RADII.control,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  smallButtonText: { color: COLORS.white, fontWeight: '800' },
  secondaryButton: { backgroundColor: COLORS.soft, marginRight: 0 },
  secondaryButtonText: { color: COLORS.primary },
  emptyState: {
    marginTop: SPACING.xl,
    padding: SPACING.xl,
    borderRadius: RADII.card,
    backgroundColor: COLORS.soft,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 16,
    color: COLORS.navy,
    fontWeight: '900',
  },
  emptySubtitle: {
    marginTop: 6,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationCard: {
    backgroundColor: COLORS.soft,
    borderRadius: RADII.card,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  unreadCard: {
    backgroundColor: '#E8F5FF',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notificationTitle: {
    color: COLORS.navy,
    fontWeight: '800',
    fontSize: 15,
    flex: 1,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginLeft: 10,
  },
  notificationDetail: {
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    color: COLORS.muted,
    fontSize: 12,
  },
  statusText: {
    marginTop: 18,
    color: COLORS.muted,
    fontSize: 13,
  },
});
