// Small shared pieces for the 7 Day Lock In screens, in TINT's own look:
// orange (Colors.pop) for the one action that matters, pixel font for
// numbers/eyebrows, Inter for everything else.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { BLOCKABLE_APPS } from '../data/blockableApps';

export const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}> = ({ label, onPress, disabled, loading }) => (
  <TouchableOpacity
    style={[ps.primary, (disabled || loading) && ps.primaryDisabled]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.85}
  >
    {loading
      ? <ActivityIndicator color="#000" />
      : <Text style={ps.primaryText}>{label}</Text>}
  </TouchableOpacity>
);

export const SecondaryButton: React.FC<{ label: string; onPress: () => void; disabled?: boolean }> = ({ label, onPress, disabled }) => (
  <TouchableOpacity style={[ps.secondary, disabled && ps.primaryDisabled]} onPress={onPress} disabled={disabled} activeOpacity={0.75}>
    <Text style={ps.secondaryText}>{label}</Text>
  </TouchableOpacity>
);

export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={ps.eyebrow}>{children}</Text>
);

/** Toggle grid of the blockable apps. */
export const AppPicker: React.FC<{ selected: string[]; onChange: (ids: string[]) => void }> = ({ selected, onChange }) => (
  <View style={ps.appGrid}>
    {BLOCKABLE_APPS.map(app => {
      const on = selected.includes(app.id);
      return (
        <TouchableOpacity
          key={app.id}
          style={[ps.appChip, on && ps.appChipOn]}
          onPress={() => onChange(on ? selected.filter(id => id !== app.id) : [...selected, app.id])}
          activeOpacity={0.75}
        >
          <Ionicons name={app.icon} size={16} color={on ? '#000' : Colors.textSecondary} />
          <Text style={[ps.appChipText, on && ps.appChipTextOn]} numberOfLines={1}>{app.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/** Seven segments: finished days bright orange, today partly bright (by
 *  how much of today has passed), the rest dull. */
export const DayProgressBar: React.FC<{ days: number; fraction: number }> = ({ days, fraction }) => {
  const filled = fraction * days;
  return (
    <View style={ps.barRow}>
      {Array.from({ length: days }, (_, i) => {
        const part = Math.min(1, Math.max(0, filled - i));
        return (
          <View key={i} style={ps.barSegment}>
            <View style={[ps.barFill, { width: `${part * 100}%` }]} />
          </View>
        );
      })}
    </View>
  );
};

const HOLD_MS = 3000;

/** Press and hold for 3 seconds to confirm. Letting go early resets. */
export const HoldToConfirm: React.FC<{ label: string; onConfirm: () => void }> = ({ label, onConfirm }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const start = () => {
    setHolding(true);
    anim.current = Animated.timing(progress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false });
    anim.current.start(({ finished }) => {
      if (finished) onConfirm();
    });
  };
  const cancel = () => {
    setHolding(false);
    anim.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  return (
    <Pressable onPressIn={start} onPressOut={cancel} style={ps.hold}>
      <Animated.View
        style={[ps.holdFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
      />
      <Text style={ps.holdText}>{holding ? 'Keep holding…' : label}</Text>
    </Pressable>
  );
};

/** Ticks once a second — for countdowns on screen. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const ps = StyleSheet.create({
  primary: {
    backgroundColor: Colors.pop, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { fontSize: 17, fontFamily: Fonts.bold, color: '#000', letterSpacing: 0.2 },
  secondary: {
    borderRadius: BorderRadius.md, borderWidth: 2, borderColor: Colors.border,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  eyebrow: {
    fontFamily: Fonts.pixel, fontSize: 18, color: Colors.pop,
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  appChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: BorderRadius.full, borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  appChipOn: { backgroundColor: Colors.pop, borderColor: Colors.pop },
  appChipText: { fontSize: 13, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  appChipTextOn: { color: '#000' },
  barRow: { flexDirection: 'row', gap: 6 },
  barSegment: {
    flex: 1, height: 12, borderRadius: 3, overflow: 'hidden',
    backgroundColor: Colors.popGlow, borderWidth: 1, borderColor: Colors.pop + '33',
  },
  barFill: { height: '100%', backgroundColor: Colors.pop },
  hold: {
    borderRadius: BorderRadius.md, borderWidth: 2, borderColor: Colors.danger,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.dangerGlow },
  holdText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.danger },
});

export const challengeStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.xl, paddingTop: 80, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  title: { fontFamily: Fonts.pixel, fontSize: 34, color: Colors.textPrimary, letterSpacing: 0.5 },
  sub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, fontFamily: Fonts.regular },
  label: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.textMuted, letterSpacing: 1 },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.sm,
  },
  link: { textAlign: 'center', fontSize: 13, color: Colors.textSecondary, fontFamily: Fonts.medium },
});
