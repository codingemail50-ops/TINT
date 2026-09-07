import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Fonts } from '../constants/theme';
import { FLAME_PALETTES } from '../components/flameShapes';

// Boot-time brand moment: "TINT" sits dim/unlit, then a wide blocky pixel
// flame — anchored at the bottom of the letters, not moving — grows taller
// (flickering the whole time) until it covers the top of the word, as if
// burning it. Once fully grown, a smooth crossfade reveals "There is no
// tomorrow" in its place, as if it emerged from the fire. Strictly
// black/white/grey/orange, matching the rest of the app — only the pixel
// typography, alignment, and dotted top/bottom borders are borrowed from
// the moodboard, not its neon colors.

const TITLE_SIZE = 84;
const TITLE_HEIGHT = 96;
const DOT_COUNT = 18;

const PALETTE = FLAME_PALETTES.pop; // outer->core: deep orange, orange, light orange, pale gold

// ── Wide blocky flame ────────────────────────────────────────────────────
const FLAME_CELL = 12;
const FLAME_COLS = 22;
const FLAME_WIDTH = FLAME_CELL * FLAME_COLS;
const MAX_FLAME_ROWS = 13;
const MAX_FLAME_HEIGHT = FLAME_CELL * MAX_FLAME_ROWS;

// A jagged, multi-peaked silhouette (relative height per column, 0..1) —
// hand-authored rather than a smooth curve, for the blocky wildfire look
// from the reference rather than a single torch-shaped flame.
const FLAME_PROFILE = [
  0.5, 0.72, 0.58, 0.88, 0.62, 1.0, 0.68, 0.82, 0.58, 0.94,
  0.7, 0.78, 0.56, 1.0, 0.74, 0.6, 0.9, 0.66, 0.84, 0.58, 0.92, 0.64,
];

function rowColor(rowIndexFromBottom: number, totalRows: number): string {
  const frac = totalRows <= 1 ? 1 : (rowIndexFromBottom + 1) / totalRows;
  if (frac <= 0.4) return PALETTE.shades[0];
  if (frac <= 0.7) return PALETTE.shades[1];
  if (frac <= 0.9) return PALETTE.shades[2];
  return PALETTE.shades[3];
}

const WideFlame: React.FC<{ growth: number; jitter: number[] }> = ({ growth, jitter }) => (
  <View style={styles.flameRow} pointerEvents="none">
    {FLAME_PROFILE.map((p, col) => {
      const rows = Math.max(0, Math.min(MAX_FLAME_ROWS, Math.round(MAX_FLAME_ROWS * growth * p * jitter[col])));
      return (
        <View key={col} style={{ width: FLAME_CELL, flexDirection: 'column-reverse' }}>
          {Array.from({ length: rows }).map((_, i) => (
            <View key={i} style={{ width: FLAME_CELL, height: FLAME_CELL, backgroundColor: rowColor(i, rows) }} />
          ))}
        </View>
      );
    })}
  </View>
);

// ── Dotted top/bottom borders ────────────────────────────────────────────
const DotRow: React.FC<{ position: 'top' | 'bottom' }> = ({ position }) => (
  <View style={[dotStyles.row, position === 'top' ? { top: 30 } : { bottom: 30 }]}>
    {Array.from({ length: DOT_COUNT }).map((_, i) => (
      <View key={i} style={[dotStyles.dot, i % 3 === 0 && dotStyles.dotPop]} />
    ))}
  </View>
);

type Phase = 'growing' | 'transitioning' | 'done';

const GROWTH_STEPS = 10;
const HOLD_FLICKER_STEPS = 5;
const STEP_MS = 140;
const CROSSFADE_MS = 600;

function randomJitter(): number[] {
  return FLAME_PROFILE.map(() => 0.82 + Math.random() * 0.34);
}

export const SplashScreen: React.FC = () => {
  const [step, setStep] = useState(0);
  const [jitter, setJitter] = useState<number[]>(randomJitter());
  const [phase, setPhase] = useState<Phase>('growing');
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let s = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      s += 1;
      setStep(s);
      setJitter(randomJitter());

      if (s >= GROWTH_STEPS + HOLD_FLICKER_STEPS) {
        setPhase('transitioning');
        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 0, duration: CROSSFADE_MS, useNativeDriver: true }),
          Animated.timing(taglineOpacity, { toValue: 1, duration: CROSSFADE_MS, useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished && !cancelled) setPhase('done'); });
        return;
      }
      timeoutId = setTimeout(tick, STEP_MS);
    };

    timeoutId = setTimeout(tick, STEP_MS);
    return () => { cancelled = true; clearTimeout(timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const growth = Math.min(1, step / GROWTH_STEPS);

  return (
    <View style={styles.container}>
      <DotRow position="top" />

      <View style={styles.stack}>
        <Animated.View style={[styles.stackLayer, { opacity: titleOpacity }]}>
          <View style={styles.titleBox}>
            <Text style={styles.title}>TINT</Text>
            {phase === 'growing' && <WideFlame growth={growth} jitter={jitter} />}
          </View>
        </Animated.View>

        <Animated.View style={[styles.stackLayer, { opacity: taglineOpacity }]}>
          <Text style={styles.tagline}>There is no tomorrow</Text>
        </Animated.View>
      </View>

      <DotRow position="bottom" />
    </View>
  );
};

const dotStyles = StyleSheet.create({
  row: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 20,
  },
  dot: { width: 5, height: 5, backgroundColor: Colors.gray[500] },
  dotPop: { backgroundColor: Colors.pop, width: 6, height: 6 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  stack: { width: '100%', height: 210, alignItems: 'center', justifyContent: 'center' },
  stackLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: '100%' },

  titleBox: {
    height: TITLE_HEIGHT, width: FLAME_WIDTH,
    justifyContent: 'flex-end', alignItems: 'center', position: 'relative',
  },
  title: {
    fontFamily: Fonts.pixel, fontSize: TITLE_SIZE, color: Colors.gray[700],
    letterSpacing: 4, textTransform: 'uppercase',
  },

  flameRow: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
    height: MAX_FLAME_HEIGHT,
  },

  tagline: {
    fontFamily: Fonts.pixel, fontSize: 20, color: Colors.gray[400],
    letterSpacing: 1, textTransform: 'uppercase',
  },
});
