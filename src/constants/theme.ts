// Black ground, pink primary accent, green for success — the exact swatch
// provided (#060606 / #f3a4a8 / #0f9b36 / #ffffff), used throughout.
export const Colors = {
  background: '#060606',
  surface: '#121212',
  surfaceElevated: '#1A1A1A',
  border: '#262626',

  primary: '#F3A4A8',
  primaryLight: '#F7C1C4',
  primaryGlow: 'rgba(243, 164, 168, 0.16)',

  accent: '#F3A4A8',
  accentLight: '#F7C1C4',
  accentGlow: 'rgba(243, 164, 168, 0.16)',

  success: '#0F9B36',
  successGlow: 'rgba(15, 155, 54, 0.16)',
  danger: '#F3A4A8',
  dangerGlow: 'rgba(243, 164, 168, 0.16)',

  textPrimary: '#FFFFFF',
  textSecondary: '#9B9B9B',
  textMuted: '#5C5C5C',

  water: '#F3A4A8',
  waterSurface: 'rgba(255, 255, 255, 0.55)',

  gradientPurple: ['#1A1A1A', '#060606'] as string[],
  gradientFire: ['#F3A4A8', '#F7C1C4'] as string[],
  gradientDark: ['#121212', '#060606'] as string[],
  gradientSuccess: ['#0F9B36', '#0C7D2C'] as string[],

  streakColors: {
    cold: '#5C5C5C',
    warm: '#F3A4A8',
    hot: '#F7C1C4',
    blazing: '#0F9B36',
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
