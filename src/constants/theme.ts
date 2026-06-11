export const Colors = {
  background: '#080810',
  surface: '#0F0F1A',
  surfaceElevated: '#161625',
  border: '#1E1E35',

  primary: '#7C3AED',
  primaryLight: '#9B5CF6',
  primaryGlow: 'rgba(124, 58, 237, 0.25)',

  accent: '#F59E0B',
  accentLight: '#FCD34D',
  accentGlow: 'rgba(245, 158, 11, 0.3)',

  success: '#10B981',
  successGlow: 'rgba(16, 185, 129, 0.25)',
  danger: '#EF4444',
  dangerGlow: 'rgba(239, 68, 68, 0.25)',

  textPrimary: '#F0F0FF',
  textSecondary: '#8B8BAE',
  textMuted: '#4A4A6A',

  gradientPurple: ['#7C3AED', '#4F46E5'] as string[],
  gradientFire: ['#F59E0B', '#EF4444'] as string[],
  gradientDark: ['#0F0F1A', '#080810'] as string[],
  gradientSuccess: ['#10B981', '#059669'] as string[],

  streakColors: {
    cold: '#4A4A6A',
    warm: '#F59E0B',
    hot: '#F97316',
    blazing: '#EF4444',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Typography = {
  displayLarge: { fontSize: 36, fontWeight: '800' as const, letterSpacing: -1 },
  displayMedium: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  headlineLarge: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  headlineMedium: { fontSize: 20, fontWeight: '700' as const },
  headlineSmall: { fontSize: 18, fontWeight: '600' as const },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
  labelLarge: { fontSize: 14, fontWeight: '600' as const, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1 },
  numeric: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -1 },
};
