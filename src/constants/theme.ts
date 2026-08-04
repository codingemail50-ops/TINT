// Dark ground with a soft lavender accent and muted pastel category tags —
// bold condensed headlines for hero moments, rounded flat cards everywhere else.
export const Colors = {
  background: '#0A0A0A',
  surface: '#151515',
  surfaceElevated: '#1A1A1A',
  border: '#262626',

  primary: '#C4A7E8',
  primaryLight: '#D8C4F0',
  primaryGlow: 'rgba(196, 167, 232, 0.16)',

  accent: '#C4A7E8',
  accentLight: '#D8C4F0',
  accentGlow: 'rgba(196, 167, 232, 0.16)',

  success: '#4ADE80',
  successGlow: 'rgba(74, 222, 128, 0.14)',
  danger: '#F87171',
  dangerGlow: 'rgba(248, 113, 113, 0.14)',

  textPrimary: '#FFFFFF',
  textSecondary: '#9B9B9B',
  textMuted: '#5C5C5C',

  gradientPurple: ['#1C1C1C', '#0A0A0A'] as string[],
  gradientFire: ['#F97316', '#EF4444'] as string[],
  gradientDark: ['#151515', '#0A0A0A'] as string[],
  gradientSuccess: ['#4ADE80', '#22C55E'] as string[],

  streakColors: {
    cold: '#5C5C5C',
    warm: '#F97316',
    hot: '#FB923C',
    blazing: '#EF4444',
  },
};

// Muted pastel tags for task/goal categories — cycled deterministically per
// category name so the same category always lands on the same color.
export const CategoryPalette = [
  '#D9C2EC', // lavender
  '#B8C4EA', // periwinkle
  '#B8DCEA', // sky
  '#B8E8D0', // mint
  '#F0CFC0', // peach
  '#F0E0B8', // sand
];

export function getCategoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  return CategoryPalette[hash % CategoryPalette.length];
}

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
