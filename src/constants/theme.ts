// Minimal OLED-dark theme: black→blue tonal scale, with a separate green
// scale reserved ONLY for "done"/completed states. One typeface throughout
// (Inter — the closest license-safe equivalent to SF Pro; Apple's actual
// SF Pro font may only ship in software for Apple platforms, and this app
// targets Google Play) at a few consistent weights, and a tight 12-18px
// corner-radius scale used everywhere instead of one-off values per screen.
const blue = {
  50: '#F4F7FB',
  100: '#E9EEF5',
  200: '#CEDAE9',
  300: '#A2BAD7',
  400: '#7096C0',
  500: '#4E79A9',
  600: '#3C608D',
  700: '#314D73',
  800: '#2B415E',
  900: '#293A51',
  950: '#1B2536',
};

// Reserved for completed/done states only — never used for structure or accents.
const green = {
  light: '#4BBC87',
  deep: '#156747',
  glow: 'rgba(75, 188, 135, 0.14)',
};

// Black/grey/white tonal scale — the dominant palette on every screen
// besides Today; blue is an accent on top of this, not the base.
const gray = {
  50: '#FAFAFA',
  100: '#F5F5F5',
  200: '#E6E6E6',
  300: '#D6D6D6',
  400: '#A5A5A5',
  500: '#767676',
  600: '#575757',
  700: '#434343',
  800: '#292929',
  900: '#1A1A1A',
  950: '#000000',
};

export const Colors = {
  background: '#060608',
  surface: '#0F1720',
  surfaceElevated: '#16212C',
  border: '#223142',

  primary: blue[400],
  primaryLight: blue[300],
  primaryGlow: blue[950],

  accent: blue[400],
  accentLight: blue[300],
  accentGlow: blue[950],

  success: green.light,
  successGlow: green.glow,
  danger: '#F87171',
  dangerGlow: '#3D1A18',

  textPrimary: '#FFFFFF',
  textSecondary: gray[400],
  textMuted: gray[600],
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
  gray,
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

// 12-18px is the working range for every card/sheet/button in the app —
// sm/full sit outside it deliberately for small chips and fully-round pills.
export const BorderRadius = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  full: 9999,
};

export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',

  // Legacy aliases — kept so existing call sites (Fonts.display / Fonts.retro)
  // don't need touching; both now resolve to Inter weights instead of the
  // old Anton/VT323 pixel fonts.
  display: 'Inter_600SemiBold',
  retro: 'Inter_500Medium',
};

export const Typography = {
  displayLarge: { fontFamily: Fonts.semibold, fontSize: 40, letterSpacing: -1 },
  displayMedium: { fontFamily: Fonts.semibold, fontSize: 30, letterSpacing: -0.5 },
  headlineLarge: { fontFamily: Fonts.semibold, fontSize: 24, letterSpacing: -0.3 },
  headlineMedium: { fontFamily: Fonts.semibold, fontSize: 20 },
  headlineSmall: { fontFamily: Fonts.semibold, fontSize: 18 },
  bodyLarge: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20 },
  bodySmall: { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18 },
  labelLarge: { fontFamily: Fonts.medium, fontSize: 14, letterSpacing: 0.5 },
  labelSmall: { fontFamily: Fonts.medium, fontSize: 11, letterSpacing: 1 },
  numeric: { fontFamily: Fonts.medium, fontSize: 32, letterSpacing: -1 },

  // Large numeric displays (timer digits, stat totals) — tight tracking,
  // same typeface as everything else, just a heavier numeric-only role.
  retroLarge: { fontFamily: Fonts.medium, fontSize: 40, letterSpacing: -1 },
  retroMedium: { fontFamily: Fonts.medium, fontSize: 22, letterSpacing: -0.5 },
  retroSmall: { fontFamily: Fonts.medium, fontSize: 15, letterSpacing: -0.3 },

  displayHeavy: { fontFamily: Fonts.semibold, fontSize: 28, letterSpacing: -0.3 },
};
