import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADII, SHADOWS, SPACING } from '../../styles/theme';

const SHARED_TABS = [
  { name: 'Home', icon: 'home-outline' },
  { name: 'Scan', icon: 'scan-helper' },
  { name: 'History', icon: 'history' },
  { name: 'Map', icon: 'map-marker-radius-outline' },
  { name: 'Settings', icon: 'cog-outline' },
];

export default function BottomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index];

  if (activeRoute?.name === 'Scan') {
    return null;
  }

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.container, SHADOWS.strong]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const item = SHARED_TABS[index];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.85}
              style={[styles.tabButton, isFocused ? styles.activeTab : null]}
            >
              <MaterialCommunityIcons
                name={item?.icon || 'help-circle-outline'}
                size={22}
                color={isFocused ? COLORS.white : COLORS.primary}
              />
              <Text style={[styles.label, isFocused ? styles.activeLabel : null]}>{route.name}</Text>
              {isFocused ? <View style={styles.activeIndicator} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: RADII.hero,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
    width: '100%',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADII.control,
    minHeight: 58,
    minWidth: 0,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    color: COLORS.primary,
  },
  activeLabel: {
    color: COLORS.white,
  },
  activeIndicator: {
    width: 18,
    height: 3,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginTop: 4,
  },
});
