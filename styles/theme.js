import { Platform } from 'react-native';

export const COLORS = {
  primary: '#1674D1',
  secondary: '#29C7EF',
  accent: '#C8F4FF',
  white: '#FFFFFF',
  navy: '#0A3159',
  text: '#173B5A',
  muted: '#607C94',
  border: '#D5E9F5',
  soft: '#F3FAFF',
  success: '#1F8F69',
  danger: '#D84D4D',
};

export const SPACING = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const RADII = {
  control: 14,
  card: 22,
  hero: 28,
  pill: 999,
};

export const SIZES = {
  touchTarget: 48,
  contentMaxWidth: 640,
};

export const LAYOUT = {
  pagePadding: 18,
  bottomTabClearance: 110,
};

export const SHADOWS = {
  card: Platform.select({
    web: {
      boxShadow: '0px 8px 24px rgba(22, 116, 209, 0.14)',
    },
    default: {
      shadowColor: '#1674D1',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 7,
    },
  }),
  strong: Platform.select({
    web: {
      boxShadow: '0px 14px 32px rgba(22, 116, 209, 0.2)',
    },
    default: {
      shadowColor: '#1674D1',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 10,
    },
  }),
};

export const TYPOGRAPHY = {
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.muted,
  },
};
