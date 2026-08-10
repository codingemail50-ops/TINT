// Flat black-and-white palette — one neutral accent (white), everything else
// is white/grey/black. No gradients, no glow. Fresh base for theme experiments.
export const Colors = {
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1C1C1C',
  border: '#2A2A2A',

  primary: '#FFFFFF',
  primaryLight: '#E8E8E8',
  primaryGlow: 'rgba(255, 255, 255, 0.08)',

  accent: '#FFFFFF',
  accentLight: '#E8E8E8',
  accentGlow: 'rgba(255, 255, 255, 0.08)',

  success: '#4ADE80',
  successGlow: 'rgba(74, 222, 128, 0.12)',
  danger: '#F87171',
  dangerGlow: 'rgba(248, 113, 113, 0.12)',

  textPrimary: '#FFFFFF',
  textSecondary: '#9B9B9B',
  textMuted: '#5C5C5C',

  water: '#FFFFFF',
  waterSurface: 'rgba(255, 255, 255, 0.55)',

  gradientPurple: ['#1C1C1C', '#0A0A0A'] as string[],
  gradientFire: ['#F97316', '#EF4444'] as string[],
  gradientDark: ['#141414', '#0A0A0A'] as string[],
  gradientSuccess: ['#4ADE80', '#22C55E'] as string[],

  streakColors: {
    cold: '#5C5C5C',
    warm: '#F97316',
    hot: '#FB923C',
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
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const Typography = {
  displayLarge: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -1 },
  displayMedium: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
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
