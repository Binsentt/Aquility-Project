import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, LAYOUT, RADII, SHADOWS, SIZES, SPACING } from '../../styles/theme';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();
  const { currentUser, refreshHistory, scanHistory } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (!currentUser?.id) return undefined;
      refreshHistory(currentUser.id).catch(() => undefined);
      return undefined;
    }, [currentUser?.id, refreshHistory])
  );

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return scanHistory;

    return scanHistory.filter((item) => {
      const haystack = `${item.title || ''} ${item.status || ''} ${item.summary || ''}`.toLowerCase();
      return haystack.includes(searchQuery.trim().toLowerCase());
    });
  }, [scanHistory, searchQuery]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Water Test History</Text>

        <View style={[styles.searchWrap, SHADOWS.card]}>
          <MaterialCommunityIcons name="magnify" size={18} color={COLORS.primary} />
          <TextInput
            placeholder="Search"
            style={styles.searchInput}
            placeholderTextColor={COLORS.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {filteredHistory.length === 0 ? (
          <View style={[styles.emptyState, SHADOWS.card]}>
            <MaterialCommunityIcons name="history" size={42} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>No water tests yet</Text>
            <Text style={styles.emptyText}>
              Completed water-test records will appear here from your AQUILITY profile. Cached records remain visible if you are temporarily offline.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Scan' })}
            >
              <Text style={styles.emptyButtonText}>Start Water Test</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredHistory.map((item) => (
            <TouchableOpacity
              key={item.id || item.title}
              style={[styles.card, SHADOWS.card]}
              onPress={() => navigation.navigate('HistoryDetail', { item })}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.title || 'Scan Result'}</Text>
                <Text style={[styles.cardStatus, item.status === 'Analysis unavailable' ? styles.unavailableStatus : null]}>
                  {item.status || 'Not available'}
                </Text>
              </View>

              {(item.imageUri || item.image || item.uri) ? (
                <Image source={{ uri: item.imageUri || item.image || item.uri }} style={styles.thumb} />
              ) : null}

              <Text style={styles.cardDate}>{new Date(item.createdAt || Date.now()).toLocaleString()}</Text>
              <Text numberOfLines={2} style={styles.cardSummary}>
                {item.summary || 'No summary available.'}
              </Text>
              <View style={styles.detailsButton}>
                <Text style={styles.detailsText}>View Details</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FBFF',
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    padding: LAYOUT.pagePadding,
    paddingTop: 52,
    paddingBottom: LAYOUT.bottomTabClearance,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: SPACING.sm,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADII.control,
    paddingHorizontal: 12,
    minHeight: SIZES.touchTarget,
    paddingVertical: 8,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: COLORS.text,
  },
  emptyState: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    marginTop: SPACING.sm,
  },
  emptyText: {
    marginTop: 8,
    color: COLORS.muted,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADII.control,
    minHeight: SIZES.touchTarget,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: '800' },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.card,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    flexShrink: 1,
    marginRight: 12,
  },
  cardStatus: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
    flexShrink: 1,
  },
  unavailableStatus: {
    color: COLORS.muted,
  },
  thumb: {
    width: '100%',
    height: 150,
    borderRadius: RADII.control,
    marginBottom: SPACING.sm,
    resizeMode: 'cover',
  },
  cardDate: {
    marginTop: 2,
    color: COLORS.muted,
    fontSize: 12,
  },
  cardSummary: {
    marginTop: 8,
    color: COLORS.text,
    lineHeight: 20,
  },
  detailsButton: {
    marginTop: 12,
    backgroundColor: COLORS.soft,
    borderRadius: RADII.control,
    minHeight: SIZES.touchTarget,
    paddingVertical: 10,
    alignItems: 'center',
  },
  detailsText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
