import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Colors, Fonts } from '../constants/theme';
import { FLAME_PALETTES, outlineCells } from '../components/flameShapes';

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

// ── Wide flame, as an actual pixel grid ──────────────────────────────────
// Same technique as the app's other pixel-flame sprites (flameShapes.ts's
// boolean-grid silhouette + outline pass + distance-shaded core, rendered as
// crisp square cells) — reshaped into a wide, short, multi-peaked mountain
// silhouette instead of one tall torch, so it spans "TINT" and reads as
// genuinely pixelated fire rather than a smooth vector shape or flat bars.
const FLAME_CELL = 11;
const FLAME_COLS = 24;
const FLAME_ROWS = 14;
const FLAME_WIDTH = FLAME_CELL * FLAME_COLS;
const MAX_FLAME_HEIGHT = FLAME_CELL * FLAME_ROWS;

// A jagged, multi-peaked silhouette (relative height per column, 0..1) —
// hand-authored rather than a smooth curve, for the blocky wildfire look
// from the reference rather than a single torch-shaped flame.
const FLAME_PROFILE = [
  0.42, 0.6, 0.48, 0.74, 0.52, 0.86, 1.0, 0.7, 0.9, 0.6,
  0.8, 0.5, 0.68, 0.96, 0.72, 0.58, 0.84, 0.62, 0.76, 0.46, 0.66, 0.4, 0.3, 0.2,
];

// Distance-from-core shading — same grading as the app's other flame
// sprites (pixelMascot.ts's buildMeditatingFlame): a small pale-gold core,
// a modest light-orange ring around it, vivid orange as the dominant body
// color, and the deepest/darkest shade reserved for a thin band near the
// silhouette's own outline — not a wide pale dome swallowing half the body.
const CORE_X = (FLAME_COLS - 1) * 0.5;
const CORE_Y = FLAME_ROWS - 1.5;
const MAX_DIST = Math.hypot(FLAME_COLS * 0.5, FLAME_ROWS * 0.8);

function shadeOf(col: number, row: number): number {
  const d = Math.hypot(col - CORE_X, row - CORE_Y) / MAX_DIST;
  return d < 0.14 ? 3 : d < 0.3 ? 2 : d < 0.62 ? 1 : 0;
}

// Once the flame has fully grown, every column must cover at least this many
// rows — otherwise the jagged low points between peaks (fine mid-growth, it
// reads as the fire still climbing) let "TINT" keep peeking through during
// the hold/burn beat, even after the flame has supposedly finished growing.
const MIN_COVER_ROWS = Math.ceil(TITLE_HEIGHT / FLAME_CELL);

function buildFlameGrid(growth: number, jitter: number[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: FLAME_ROWS }, () => Array(FLAME_COLS).fill(false));
  FLAME_PROFILE.forEach((p, col) => {
    let activeRows = Math.max(0, Math.min(FLAME_ROWS, Math.round(FLAME_ROWS * growth * p * jitter[col])));
    if (growth >= 1) activeRows = Math.max(activeRows, MIN_COVER_ROWS);
    for (let i = 0; i < activeRows; i++) grid[FLAME_ROWS - 1 - i][col] = true;
  });
  return grid;
}

const WideFlame: React.FC<{ growth: number; jitter: number[] }> = ({ growth, jitter }) => {
  const grid = buildFlameGrid(growth, jitter);
  const outline = outlineCells(grid, FLAME_COLS, FLAME_ROWS);
  const cells: { x: number; y: number; shade: number }[] = [];
  for (let row = 0; row < FLAME_ROWS; row++) {
    for (let col = 0; col < FLAME_COLS; col++) {
      if (grid[row][col]) cells.push({ x: col, y: row, shade: shadeOf(col, row) });
    }
  }
  return (
    <Svg width={FLAME_WIDTH} height={MAX_FLAME_HEIGHT} viewBox={`0 0 ${FLAME_WIDTH} ${MAX_FLAME_HEIGHT}`} style={styles.flameRow} pointerEvents="none">
      {outline.map((c, i) => (
        <Rect key={`o${i}`} x={c.x * FLAME_CELL} y={c.y * FLAME_CELL} width={FLAME_CELL} height={FLAME_CELL} fill={PALETTE.outline} />
      ))}
      {cells.map((c, i) => (
        <Rect key={i} x={c.x * FLAME_CELL} y={c.y * FLAME_CELL} width={FLAME_CELL} height={FLAME_CELL} fill={PALETTE.shades[c.shade]} />
      ))}
    </Svg>
  );
};

// ── Dotted top/bottom borders ────────────────────────────────────────────
const DotRow: React.FC<{ position: 'top' | 'bottom' }> = ({ position }) => (
  <View style={[dotStyles.row, position === 'top' ? { top: 30 } : { bottom: 30 }]}>
    {Array.from({ length: DOT_COUNT }).map((_, i) => (
      <View key={i} style={[dotStyles.dot, i % 3 === 0 && dotStyles.dotPop]} />
    ))}
  </View>
);

type Phase = 'growing' | 'transitioning' | 'done';

// Finer, more frequent steps than a first pass at this (10 steps @ 140ms)
// read as choppy — same rough growth duration, but ~4x the steps makes each
// row-count jump small enough to look like continuous motion instead of a
// stepped climb. Hold is timed to ~1s of visible full-height burn before the
// crossfade, per how long the flame should sit at the top before yielding to
// the tagline.
const STEP_MS = 40;
const GROWTH_STEPS = 24; // ~960ms to climb
const HOLD_FLICKER_STEPS = 25; // ~1000ms burning at full height
const CROSSFADE_MS = 500;

function randomJitter(): number[] {
  return FLAME_PROFILE.map(() => 0.88 + Math.random() * 0.24);
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
            {/* Stays mounted through the crossfade (not just while growing) so
                it fades out together with the title it's covering — dropping
                it the instant the fade starts let bare "TINT" flash back into
                view for that whole 500ms before the tagline took over. */}
            {phase !== 'done' && <WideFlame growth={growth} jitter={jitter} />}
          </View>
        </Animated.View>

        <Animated.View style={[styles.stackLayer, { opacity: taglineOpacity }]}>
          <Text style={styles.tagline}>THERE IS</Text>
          <Text style={styles.tagline}>NO TOMORROW</Text>
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

  flameRow: { position: 'absolute', left: 0, bottom: 0 },

  // Matches TodoScreen's header tagline exactly (same text, split the same
  // way) — the splash's version previously used a dimmer grey, a single
  // line, and different sizing, which read as a different typographic
  // treatment from the one the rest of the app actually uses for this line.
  tagline: {
    fontFamily: Fonts.pixel, fontSize: 22, color: Colors.pop,
    letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 22, textAlign: 'center',
  },
});
