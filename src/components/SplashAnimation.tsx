import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Colors, Fonts } from '../constants/theme';
import { FLAME_PALETTES, outlineCells } from './flameShapes';

interface Props {
  /** Fires once, right when the sequence lands (flame gone, phrase settled
   *  after its zoom) — NOT after some external timer. The caller (see
   *  AppNavigator's boot screen) decides when to actually navigate away;
   *  this component just holds on the final frame for as long as it stays
   *  mounted, so a slow network never exposes a blank gap behind a
   *  self-timed fade-out. */
  onFinish: () => void;
}

// A plain rectangular "wall" of pixels the flame fills/empties, sized to sit
// over the TINT/tagline text — deliberately a flat block, not a mountain
// silhouette (contrast with the bonfire's stage art), since it has to
// completely cover the text's bounding box with zero gaps at its peak.
const CELL = 12;
const COLS = 18;
const ROWS = 8;
const GRID_W = CELL * COLS;
const GRID_H = CELL * ROWS;
const STAGE_W = 240;

const PALETTE = FLAME_PALETTES.pop; // outline, then outer->core: deep orange, orange, light orange, pale gold

const CORE_X = (COLS - 1) * 0.5;
const CORE_Y = ROWS - 1.5;
const MAX_DIST = Math.hypot(COLS * 0.5, ROWS * 0.8);
function shadeOf(col: number, row: number): number {
  const d = Math.hypot(col - CORE_X, row - CORE_Y) / MAX_DIST;
  return d < 0.14 ? 3 : d < 0.3 ? 2 : d < 0.62 ? 1 : 0;
}

interface Cell { x: number; y: number; color: string }

// coverage 0 = fully clear, 1 = fully covered — used both while rising
// (0->1, engulfing upward) and while receding (1->0, revealing downward:
// shrinking the covered-from-the-bottom row count always uncovers the
// TOPMOST covered row first, which is exactly "reveals top to bottom").
// jitterAmp is a parabola that's zero at coverage 0 AND 1 and peaks at
// 0.5, so the edge is only ever ragged mid-transition — it's mathematically
// impossible for this to leave a stray gap at full coverage or a stray
// pixel at zero coverage, both of which the brief calls out explicitly
// ("no TINT visible anywhere" / "no stray pixels").
function buildCells(coverage: number, jitter: number[]): Cell[] {
  const grid: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const jitterAmp = 4 * coverage * (1 - coverage);
  for (let col = 0; col < COLS; col++) {
    const raw = ROWS * coverage + jitter[col] * 2.4 * jitterAmp;
    const activeRows = Math.max(0, Math.min(ROWS, Math.round(raw)));
    for (let i = 0; i < activeRows; i++) grid[ROWS - 1 - i][col] = true;
  }
  const cells: Cell[] = [];
  for (const { x, y } of outlineCells(grid, COLS, ROWS)) cells.push({ x, y, color: PALETTE.outline });
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (grid[y][x]) cells.push({ x, y, color: PALETTE.shades[shadeOf(x, y)] });
  }
  return cells;
}

function randomJitter(): number[] {
  return Array.from({ length: COLS }, () => Math.random() * 2 - 1);
}

// Small pixel "shooting star" streaks for the final beat — a short diagonal
// run of shrinking, dimming squares, not a realistic star/sparkle.
const STARS: { top: number; left: number; dir: 1 | -1 }[] = [
  { top: 40, left: 36, dir: 1 },
  { top: 64, left: 188, dir: -1 },
  { top: 260, left: 24, dir: 1 },
];

function StarStreak({ top, left, dir }: { top: number; left: number; dir: 1 | -1 }) {
  return (
    <View style={[styles.star, { top, left }]}>
      {[0, 1, 2].map(i => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: dir * i * 5,
            top: i * 5,
            width: 4 - i,
            height: 4 - i,
            backgroundColor: i === 0 ? Colors.orange.light : Colors.gray[500],
            opacity: 1 - i * 0.35,
          }}
        />
      ))}
    </View>
  );
}

const PHASE1_MS = 600; // TINT alone
const STEP_MS = 35;
const GROW_STEPS = 14; // ~490ms — flame rises, engulfs TINT
const HOLD_MS = 300; // flame at full coverage — TINT is 100% hidden here
const RECEDE_STEPS = 14; // ~490ms — flame recedes downward, revealing the phrase
const FINAL_MS = 500; // subtle zoom + stars, flame already gone

export const SplashAnimation: React.FC<Props> = ({ onFinish }) => {
  const [cells, setCells] = useState<Cell[]>([]);
  const tintOpacity = useRef(new Animated.Value(1)).current;
  const phraseOpacity = useRef(new Animated.Value(0)).current;
  const phraseScale = useRef(new Animated.Value(1)).current;
  const starsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { if (!cancelled) fn(); }, ms);
      timers.push(id);
    };

    let growStep = 0;
    const growTick = () => {
      growStep += 1;
      const coverage = Math.min(1, growStep / GROW_STEPS);
      setCells(buildCells(coverage, randomJitter()));
      if (growStep >= GROW_STEPS) {
        // Fully covered — swap which text is "live" underneath while it's
        // completely hidden, per the brief: the phrase must already exist
        // behind the flame before it starts moving down, not fade in after.
        tintOpacity.setValue(0);
        phraseOpacity.setValue(1);
        schedule(startRecede, HOLD_MS);
      } else {
        schedule(growTick, STEP_MS);
      }
    };

    let recedeStep = 0;
    const recedeTick = () => {
      recedeStep += 1;
      const coverage = Math.max(0, 1 - recedeStep / RECEDE_STEPS);
      setCells(buildCells(coverage, randomJitter()));
      if (recedeStep >= RECEDE_STEPS) {
        runFinalBeat();
      } else {
        schedule(recedeTick, STEP_MS);
      }
    };
    const startRecede = () => { recedeStep = 0; schedule(recedeTick, STEP_MS); };

    const runFinalBeat = () => {
      Animated.parallel([
        Animated.timing(phraseScale, { toValue: 1.06, duration: FINAL_MS, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(starsOpacity, { toValue: 1, duration: FINAL_MS, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) onFinish(); });
    };

    schedule(growTick, PHASE1_MS);
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root} pointerEvents="none">
      {STARS.map((s, i) => (
        <Animated.View key={i} style={{ opacity: starsOpacity }}>
          <StarStreak {...s} />
        </Animated.View>
      ))}
      <View style={styles.stage}>
        <Animated.Text style={[styles.tint, { opacity: tintOpacity }]}>TINT</Animated.Text>
        <Animated.View style={[styles.phraseWrap, { opacity: phraseOpacity, transform: [{ scale: phraseScale }] }]}>
          <Text style={styles.phrase}>
            <Text style={styles.phraseGrey}>THERE IS</Text>
            {'\n'}
            <Text style={styles.phraseOrange}>NO TOMORROW</Text>
          </Text>
        </Animated.View>
        <Svg
          width={GRID_W}
          height={GRID_H}
          viewBox={`0 0 ${GRID_W} ${GRID_H}`}
          style={styles.flame}
        >
          {cells.map((c, i) => (
            <Rect key={i} x={c.x * CELL} y={c.y * CELL} width={CELL} height={CELL} fill={c.color} />
          ))}
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    width: STAGE_W,
    height: GRID_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tint: {
    position: 'absolute',
    fontFamily: Fonts.bold,
    fontSize: 56,
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
  phraseWrap: {
    position: 'absolute',
    width: STAGE_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phrase: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  phraseGrey: { color: Colors.textSecondary },
  phraseOrange: { color: Colors.pop },
  flame: {
    position: 'absolute',
  },
  star: {
    position: 'absolute',
    width: 20,
    height: 20,
  },
});
