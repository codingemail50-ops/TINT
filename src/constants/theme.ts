// Minimal OLED-dark, fully monochrome theme: black→white/grey tonal scale
// for everything, including what used to be the blue accent — "primary"
// and "accent" below are grey/white now, not blue. A separate green scale
// stays reserved ONLY for "done"/completed states, and danger stays red,
// since those are functional status signals, not decorative theme color.
// One typeface throughout (Inter — the closest license-safe equivalent to
// SF Pro; Apple's actual SF Pro font may only ship in software for Apple
// platforms, and this app targets Google Play) at a few consistent
// weights, and a tight 12-18px corner-radius scale used everywhere
// instead of one-off values per screen.
// Reserved for completed/done states only — never used for structure or accents.
const green = {
  light: '#4BBC87',
  deep: '#156747',
  glow: 'rgba(75, 188, 135, 0.14)',
};

// Black/grey/white tonal scale — the only palette in the app now. Blue
// used to be layered on top as an accent; it isn't anymore.
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

// The one deliberate pop of color against the black/white base — used
// sparingly (CTAs, active states, brand accents), not as the base palette.
const orange = {
  light: '#FFA352',
  DEFAULT: '#FF6A00',
  deep: '#C84E00',
  glow: 'rgba(255, 106, 0, 0.16)',
};

export const Colors = {
  background: '#060608',
  surface: gray[900],
  surfaceElevated: gray[800],
  border: gray[700],

  primary: gray[100],
  primaryLight: gray[300],
  primaryGlow: gray[700],

  accent: gray[100],
  accentLight: gray[300],
  accentGlow: gray[700],

  pop: orange.DEFAULT,
  popLight: orange.light,
  popDeep: orange.deep,
  popGlow: orange.glow,

  success: green.light,
  successGlow: green.glow,
  danger: '#F87171',
  dangerGlow: '#3D1A18',

  textPrimary: '#FFFFFF',
  textSecondary: gray[400],
  textMuted: gray[600],
  ink: gray[900],

  water: gray[400],
  waterSurface: 'rgba(165, 165, 165, 0.55)',

  gradientPurple: [gray[800], '#060608'] as string[],
  gradientFire: [gray[300], gray[600]] as string[],
  gradientDark: [gray[800], '#060608'] as string[],
  gradientSuccess: [green.light, green.deep] as string[],
  gradientBlue: [gray[300], gray[600]] as string[],
  gradientScreenTime: ['#FFFFFF', '#9B9B9B'] as string[],

  streakColors: {
    cold: gray[600],
    warm: gray[400],
    hot: gray[300],
    blazing: gray[100],
  },

  green,
  gray,
  orange,
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

  // The gamified pixel font — reserved for the brand wordmark and timer
  // digits only. Everything else on screen stays Inter; this is a
  // deliberate accent, not the base UI font.
  pixel: 'VT323_400Regular',

  // Legacy aliases — kept so existing call sites (Fonts.display / Fonts.retro)
  // don't need touching; both resolve to Inter weights, not the pixel font.
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
