// Retro/gamified theme: black→blue tonal scale, with a separate green scale
// reserved ONLY for "done"/completed states. Display font is Anton (bold
// poster headlines), retro/numeric font is VT323 (pixel timer digits).
const blue = {
  50: '#F3F8FC',
  100: '#E5F0F9',
  200: '#C6DFF1',
  300: '#93C5E6',
  400: '#73B5DD',
  500: '#348DC3',
  600: '#2470A5',
  700: '#1E5A86',
  800: '#1D4D6F',
  900: '#1D415D',
  950: '#132A3E',
};

// Reserved for completed/done states only — never used for structure or accents.
const green = {
  light: '#4BBC87',
  deep: '#156747',
  glow: 'rgba(75, 188, 135, 0.14)',
};

export const Colors = {
  background: '#060608',
  surface: '#0F1720',
  surfaceElevated: '#16212C',
  border: '#223142',

  primary: blue[400],
  primaryLight: blue[300],
  primaryGlow: 'rgba(115, 181, 221, 0.12)',

  accent: blue[400],
  accentLight: blue[300],
  accentGlow: 'rgba(115, 181, 221, 0.12)',

  success: green.light,
  successGlow: green.glow,
  danger: '#F87171',
  dangerGlow: 'rgba(248, 113, 113, 0.12)',

  textPrimary: '#FFFFFF',
  textSecondary: '#9B9B9B',
  textMuted: '#5C5C5C',
  ink: '#0C1A26',

  water: blue[400],
  waterSurface: 'rgba(115, 181, 221, 0.55)',

  gradientPurple: [blue[950], '#060608'] as string[],
  gradientFire: ['#F97316', '#EF4444'] as string[],
  gradientDark: [blue[950], '#060608'] as string[],
  gradientSuccess: [green.light, green.deep] as string[],
  gradientBlue: [blue[300], blue[600]] as string[],
  gradientScreenTime: ['#FFFFFF', '#9B9B9B'] as string[],

  streakColors: {
    cold: '#5C5C5C',
    warm: '#F97316',
    hot: '#FB923C',
    blazing: '#EF4444',
  },

  blue,
  green,
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

export const Fonts = {
  display: 'Anton_400Regular',
  retro: 'VT323_400Regular',
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

  // Retro pixel-font variants (VT323) — for timer digits, badges, wordmark
  retroLarge: { fontSize: 40, fontFamily: 'VT323_400Regular' as const, letterSpacing: 1 },
  retroMedium: { fontSize: 22, fontFamily: 'VT323_400Regular' as const, letterSpacing: 0.5 },
  retroSmall: { fontSize: 15, fontFamily: 'VT323_400Regular' as const, letterSpacing: 0.5 },

  // Display font (Anton) — bold poster headlines
  displayHeavy: { fontSize: 28, fontFamily: 'Anton_400Regular' as const, letterSpacing: 0.5 },
};
