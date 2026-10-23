// Small shared pieces for the 7 Day Lock In screens, in TINT's own look:
// orange (Colors.pop) for the one action that matters, pixel font for
// numbers/eyebrows, Inter for everything else.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { BLOCKABLE_APPS } from '../data/blockableApps';
import Svg, { Path, Rect } from 'react-native-svg';
import { buildBonfireStage, BONFIRE_STAGE_COUNT } from './pixelBonfireStages';

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

/** The blockable apps, one per row, in a box that scrolls. By default the box
 *  is the same height the old grid of chips took, so what comes after it stays
 *  put. With `fill` it takes whatever space its parent has left (parent must
 *  have a height). */
export const AppPicker: React.FC<{ selected: string[]; onChange: (ids: string[]) => void; fill?: boolean }> = ({ selected, onChange, fill }) => (
  <View style={fill ? ps.appListBoxFill : ps.appListBox}>
    <ScrollView
      nestedScrollEnabled
      showsVerticalScrollIndicator
      persistentScrollbar
      contentContainerStyle={[ps.appList, fill && ps.appListCompact]}
    >
      {BLOCKABLE_APPS.map(app => {
        const on = selected.includes(app.id);
        return (
          <TouchableOpacity
            key={app.id}
            style={[ps.appRow, fill && ps.appRowCompact, on && ps.appRowOn]}
            onPress={() => onChange(on ? selected.filter(id => id !== app.id) : [...selected, app.id])}
            activeOpacity={0.75}
          >
            <Ionicons name={app.icon} size={fill ? 18 : 20} color={on ? '#000' : Colors.textSecondary} />
            <Text style={[ps.appRowText, on && ps.appRowTextOn]} numberOfLines={1}>{app.label}</Text>
            <Ionicons
              name={on ? 'checkmark-circle' : 'ellipse-outline'}
              size={fill ? 20 : 22}
              color={on ? '#000' : Colors.textMuted}
            />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
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

// Day -> bonfire size and color, like the Today screen's bonfire: a small
// dark flame on day 1, the biggest and brightest on day 7.
const DAY_STAGE = [3, 3, 4, 4, 5, 5, 6];
const DAY_PALETTE = ['lockinDim', 'lockinDim', 'lockinMid', 'lockinMid', 'lockinMid', 'lockin', 'lockin'];
const TALLEST_ROWS = (() => {
  const def = buildBonfireStage(BONFIRE_STAGE_COUNT, 'lockin');
  return def.rows - Math.min(...def.cells.map(c => c.y));
})();

/** The Lock In bonfire for a given day (1-7; 0 = not started, shown as day 1). */
export const LockInBonfire: React.FC<{ day: number; maxHeight?: number }> = ({ day, maxHeight = 56 }) => {
  const i = Math.min(6, Math.max(0, day - 1));
  const def = React.useMemo(() => buildBonfireStage(DAY_STAGE[i], DAY_PALETTE[i]), [i]);
  const minY = React.useMemo(() => Math.min(...def.cells.map(c => c.y)), [def]);
  const cropRows = def.rows - minY;
  const scale = maxHeight / TALLEST_ROWS;
  const breathe = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1.05, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breathe]);
  return (
    <View style={{ height: maxHeight, justifyContent: 'flex-end', alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale: breathe }] }}>
        <Svg width={scale * def.cols} height={scale * cropRows} viewBox={`0 ${minY} ${def.cols} ${cropRows}`}>
          {def.cells.map((c, k) => (
            <Rect key={k} x={c.x} y={c.y} width={1} height={1} fill={c.color} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
};

// The TINT logo flame, cell for cell (traced from the logo artwork).
// Digits are shades on the Lock In ramp, '.' is empty. Single cells off on
// their own are embers and flicker.
const LOGO_FLAME = [
  '..4.............',
  '................',
  '...4............',
  '.......1........',
  '.......21.......',
  '......142.......',
  '.......421......',
  '......1441......',
  '4...1.14441.....',
  '...12124641...4.',
  '...14144641.....',
  '..143245641.1...',
  '.114444654212...',
  '11444466644241..',
  '12446667644641..',
  '14446677664641..',
  '.145667775641...',
  '..1446776642...4',
  '...11455441.....',
  '.....22221......',
];
const LOGO_COLS = LOGO_FLAME[0].length;
const LOGO_ROWS = LOGO_FLAME.length;
const SHADE: Record<string, string> = {
  '1': '#782401', // deep brown: outline/shadow
  '2': '#A03201', // dark orange
  '3': '#C44301', // burnt orange
  '4': '#F45F01', // main orange
  '5': '#FB7E18', // bright orange
  '6': '#FCC268', // light orange
  '7': '#FDE0B0', // hot core
};

function isEmber(x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && (LOGO_FLAME[y + dy]?.[x + dx] ?? '.') !== '.') return false;
    }
  }
  return true;
}

/** Paths per color: `dim` 0 = full brightness, each step darkens the
 *  flame body by one shade (the outline stays the same). */
function logoPaths(dim: number, embers: boolean): [string, string][] {
  const byColor = new Map<string, string>();
  LOGO_FLAME.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || isEmber(x, y) !== embers) continue;
      const shade = ch === '1' ? 1 : Math.max(2, Number(ch) - dim);
      const color = SHADE[String(shade)];
      byColor.set(color, (byColor.get(color) ?? '') + `M${x},${y}h1v1h-1z`);
    }
  });
  return Array.from(byColor.entries());
}

/** The TINT logo flame, breathing, with flickering embers. */
export const LogoFlame: React.FC<{ size?: number; dim?: number }> = ({ size = 110, dim = 0 }) => {
  const body = React.useMemo(() => logoPaths(dim, false), [dim]);
  const sparks = React.useMemo(() => logoPaths(dim, true), [dim]);
  const breathe = useRef(new Animated.Value(1)).current;
  const flicker = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1.04, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const b = Animated.loop(Animated.sequence([
      Animated.timing(flicker, { toValue: 0.25, duration: 420, useNativeDriver: true }),
      Animated.timing(flicker, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]));
    a.start();
    b.start();
    return () => { a.stop(); b.stop(); };
  }, [breathe, flicker]);
  const height = (size / LOGO_COLS) * LOGO_ROWS;
  const box = `0 0 ${LOGO_COLS} ${LOGO_ROWS}`;
  return (
    <Animated.View style={{ width: size, height, transform: [{ scale: breathe }] }}>
      <Svg width={size} height={height} viewBox={box}>
        {body.map(([color, d]) => <Path key={color} d={d} fill={color} />)}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: flicker }]}>
        <Svg width={size} height={height} viewBox={box}>
          {sparks.map(([color, d]) => <Path key={color} d={d} fill={color} />)}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

/** The logo flame for a challenge day: small and darker on day 1, full
 *  size and brightest on day 7. */
export const DayFlame: React.FC<{ day: number; maxSize?: number }> = ({ day, maxSize = 56 }) => {
  const d = Math.min(7, Math.max(1, day));
  const size = Math.round(maxSize * (0.55 + 0.45 * ((d - 1) / 6)));
  const dim = d <= 2 ? 2 : d <= 5 ? 1 : 0;
  return (
    <View style={{ height: (maxSize / LOGO_COLS) * LOGO_ROWS, justifyContent: 'flex-end', alignItems: 'center' }}>
      <LogoFlame size={size} dim={dim} />
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
  appListBox: {
    height: 216, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, overflow: 'hidden',
  },
  appListBoxFill: {
    flex: 1, minHeight: 96, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, overflow: 'hidden',
  },
  appList: { padding: 8, gap: 8 },
  appListCompact: { padding: 6, gap: 6 },
  appRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, height: 48,
    paddingHorizontal: 14, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  appRowCompact: { height: 40, paddingHorizontal: 12, gap: 10 },
  appRowOn: { backgroundColor: Colors.pop, borderColor: Colors.pop },
  appRowText: { flex: 1, fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  appRowTextOn: { color: '#000' },
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
