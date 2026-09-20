import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts } from '../constants/theme';
import { FLAME_PALETTES } from './flameShapes';

interface Props {
  /** Fires once, when the sequence lands (flame gone, zoom settled). The
   *  caller decides when to navigate away — this holds on the final frame
   *  for as long as it stays mounted, so a slow boot never exposes a gap
   *  behind a self-timed fade-out. */
  onFinish: () => void;
}

// ── Grid ─────────────────────────────────────────────────────────────────
// ~30 cells across at roughly 1/6 the lettering's cap height, matching the
// reference frames: chunky enough to read as sprite art, fine enough to
// actually form tongues instead of a blocky skyline.
const CELL = 8;
const COLS = 30;
const ROWS = 30;
const GRID = CELL * COLS;

const STAGE_W = 260;
const STAGE_H = 420;
const GRID_LEFT = (STAGE_W - GRID) / 2;
const GRID_TOP = 8; // puts the grid's bottom edge just under the text baseline

const PALETTE = FLAME_PALETTES.pop; // deep orange -> orange -> light orange -> pale

// Solid band under the tongues. This is what guarantees the lettering is
// covered at full height (9 rows = 72px, clearing the top of the glyphs
// with ~18px to spare), which is precisely why the silhouette above it is
// free to stay as ragged as the reference — coverage never depends on the
// top edge flattening out.
const BASE_ROWS = 9;
const PEAK_ROWS = 13;

// Eight tongues, deliberately uneven: tallest is ~1.8x the shortest, and
// they're narrow enough not to blend into one dome, so the valleys between
// them fall to ~40% of peak height.
const TONGUES = [
  { pos: 0.07, w: 0.075, h: 0.55 },
  { pos: 0.19, w: 0.085, h: 0.82 },
  { pos: 0.31, w: 0.070, h: 0.60 },
  { pos: 0.43, w: 0.090, h: 1.00 },
  { pos: 0.55, w: 0.075, h: 0.70 },
  { pos: 0.67, w: 0.090, h: 0.90 },
  { pos: 0.79, w: 0.070, h: 0.56 },
  { pos: 0.90, w: 0.080, h: 0.78 },
];

// Parabolic falloff per tongue, max-combined: gives each one a 1-2 cell tip
// that widens as it descends — a tongue, not a bar.
const TONGUE_AT: number[] = Array.from({ length: COLS }, (_, i) => {
  const frac = i / (COLS - 1);
  let best = 0;
  for (const t of TONGUES) {
    const d = Math.abs(frac - t.pos) / t.w;
    if (d >= 1) continue;
    const v = t.h * (1 - d * d);
    if (v > best) best = v;
  }
  return best;
});

// Steps the outer columns in so the mass's sides are notched rather than
// two straight verticals. Only touches columns well outside the text.
const SIDE_TAPER: number[] = Array.from({ length: COLS }, (_, i) => {
  const edge = Math.min(i, COLS - 1 - i);
  return edge === 0 ? 0.55 : edge === 1 ? 0.8 : 1;
});

// Fixed (not per-frame random) ignition order, so frame 2 reads as a broken
// scatter of clusters that fills in — an authored burn-in rather than noise
// flickering columns on and off.
const IGNITE: number[] = Array.from({ length: COLS }, (_, i) => (((i * 37) % 11) / 11) * 0.34);

type Frame = { d0: string; d1: string; d2: string; d3: string };
const EMPTY_FRAME: Frame = { d0: '', d1: '', d2: '', d3: '' };

function columnHeights(growth: number, shift: number, flicker: number[]): number[] {
  return TONGUE_AT.map((tv, i) => {
    if (growth <= IGNITE[i]) return 0;
    const g = Math.min(1, (growth - IGNITE[i]) / (1 - IGNITE[i]));
    const base = BASE_ROWS * g * SIDE_TAPER[i];
    const peak = (PEAK_ROWS * tv + flicker[i]) * g;
    return Math.max(0, Math.min(ROWS, Math.round(base + peak - shift)));
  });
}

function buildFrame(heights: number[], embers: [number, number][]): Frame {
  // Below the grid counts as solid so the base isn't rimmed like a tip.
  const filled = (c: number, r: number): boolean => {
    if (c < 0 || c >= COLS) return false;
    if (r >= ROWS) return true;
    if (r < 0) return false;
    return r >= ROWS - heights[c];
  };

  const depth: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  const queue: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!filled(c, r)) continue;
      if (!filled(c - 1, r) || !filled(c + 1, r) || !filled(c, r - 1) || !filled(c, r + 1)) {
        depth[r][c] = 0;
        queue.push([c, r]);
      }
    }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const [c, r] = queue[qi];
    const next = Math.min(6, depth[r][c] + 1);
    const around: [number, number][] = [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]];
    for (const [nc, nr] of around) {
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (!filled(nc, nr) || depth[nr][nc] !== -1) continue;
      depth[nr][nc] = next;
      queue.push([nc, nr]);
    }
  }

  const parts = ['', '', '', ''];
  const square = (c: number, r: number) => `M${c * CELL} ${r * CELL}h${CELL}v${CELL}h-${CELL}z`;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const d = depth[r][c];
      if (d < 0) continue;
      // Cools with height as well as proximity to the edge: a fat lower body
      // goes pale, a narrow tongue stays deep orange all the way up, and
      // only the wider tongues carry light orange up their middle — which is
      // the distribution the reference frames actually show.
      const h = heights[c];
      const heightFrac = h > 1 ? (ROWS - 1 - r) / (h - 1) : 0;
      const score = d - 2.8 * heightFrac;
      const shade = score >= 3 ? 3 : score >= 1.6 ? 2 : score >= 0.6 ? 1 : 0;
      parts[shade] += square(c, r);
    }
  }

  for (const [c, r] of embers) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS || filled(c, r)) continue;
    // Higher embers are cooler.
    const tip = ROWS - heights[c];
    parts[tip - r > 4 ? 0 : 1] += square(c, r);
  }

  return { d0: parts[0], d1: parts[1], d2: parts[2], d3: parts[3] };
}

function randomFlicker(): number[] {
  return Array.from({ length: COLS }, () => Math.round(Math.random() * 2 - 1));
}

// Loose pixels riding above the tips: count scales with the flame, and the
// squared random biases them toward the tips so density thins out with
// height instead of scattering evenly.
function randomEmbers(heights: number[], intensity: number): [number, number][] {
  const out: [number, number][] = [];
  const count = Math.round(2 + 11 * intensity);
  for (let i = 0; i < count; i++) {
    const c = Math.floor(Math.random() * COLS);
    if (heights[c] <= 0) continue;
    const tip = ROWS - heights[c];
    const rise = 1 + Math.floor(Math.random() * Math.random() * 10);
    out.push([c, tip - rise]);
  }
  // A couple out at the shoulders rather than straight above the tall
  // middle tongues, so the ember field isn't a column of sparks.
  for (let i = 0; i < 2; i++) {
    const c = Math.random() < 0.5 ? Math.floor(Math.random() * 3) : COLS - 1 - Math.floor(Math.random() * 3);
    if (heights[c] <= 0) continue;
    out.push([c, ROWS - heights[c] - 1 - Math.floor(Math.random() * 4)]);
  }
  return out;
}

// ── Pixel shooting stars (final beat only) ───────────────────────────────
const STARS: { top: `${number}%`; left: `${number}%`; dir: 1 | -1 }[] = [
  { top: '24%', left: '16%', dir: 1 },
  { top: '31%', left: '78%', dir: -1 },
  { top: '70%', left: '22%', dir: 1 },
  { top: '76%', left: '72%', dir: -1 },
];

const StarStreak: React.FC<{ dir: 1 | -1 }> = ({ dir }) => (
  <View style={styles.star}>
    {[0, 1, 2, 3].map(i => (
      <View
        key={i}
        style={{
          position: 'absolute',
          left: 10 + dir * i * 6,
          top: i * 6,
          width: 4 - i * 0.6,
          height: 4 - i * 0.6,
          backgroundColor: i === 0 ? Colors.orange.light : Colors.orange.DEFAULT,
          opacity: 0.85 - i * 0.2,
        }}
      />
    ))}
  </View>
);

// ── Timing (from the keyframe captions) ──────────────────────────────────
const PHASE1_MS = 600;  // 0.0-0.6  TINT alone
const RISE_MS = 400;    // 0.6-1.0  ignite + rise
const HOLD_MS = 200;    // 1.0-1.2  full cover, text swaps behind
const DESCEND_MS = 600; // 1.2-1.8  drops away, revealing top-down
const SETTLE_MS = 200;  // 1.8-2.0  text alone
const ZOOM_MS = 500;    // 2.0-2.5  subtle zoom + stars
const STEP_MS = 45;
const MAX_SHIFT = BASE_ROWS + PEAK_ROWS + 2;

export const SplashAnimation: React.FC<Props> = ({ onFinish }) => {
  const [frame, setFrame] = useState<Frame>(EMPTY_FRAME);
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

    const draw = (growth: number, shift: number) => {
      const heights = columnHeights(growth, shift, randomFlicker());
      setFrame(buildFrame(heights, randomEmbers(heights, growth)));
    };

    const riseSteps = Math.round(RISE_MS / STEP_MS);
    const holdSteps = Math.round(HOLD_MS / STEP_MS);
    const descendSteps = Math.round(DESCEND_MS / STEP_MS);
    let step = 0;

    const rise = () => {
      step += 1;
      draw(step / riseSteps, 0);
      if (step >= riseSteps) { step = 0; schedule(hold, STEP_MS); }
      else schedule(rise, STEP_MS);
    };

    const hold = () => {
      step += 1;
      draw(1, 0);
      if (step === 1) {
        // Swapped while completely hidden, so the phrase is genuinely
        // already behind the flame when it starts dropping.
        tintOpacity.setValue(0);
        phraseOpacity.setValue(1);
      }
      if (step >= holdSteps) { step = 0; schedule(descend, STEP_MS); }
      else schedule(hold, STEP_MS);
    };

    const descend = () => {
      step += 1;
      draw(1, (MAX_SHIFT * step) / descendSteps);
      if (step >= descendSteps) {
        setFrame(EMPTY_FRAME);
        schedule(finalBeat, SETTLE_MS);
      } else schedule(descend, STEP_MS);
    };

    const finalBeat = () => {
      Animated.parallel([
        Animated.timing(phraseScale, { toValue: 1.06, duration: ZOOM_MS, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(starsOpacity, { toValue: 1, duration: ZOOM_MS, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) onFinish(); });
    };

    schedule(rise, PHASE1_MS);
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root} pointerEvents="none">
      {STARS.map((s, i) => (
        <Animated.View key={i} style={[styles.starSlot, { top: s.top, left: s.left, opacity: starsOpacity }]}>
          <StarStreak dir={s.dir} />
        </Animated.View>
      ))}

      <View style={styles.stage}>
        <Animated.Text style={[styles.tint, { opacity: tintOpacity }]}>TINT</Animated.Text>

        <Animated.View style={[styles.phraseWrap, { opacity: phraseOpacity, transform: [{ scale: phraseScale }] }]}>
          <Text style={styles.phraseLine}>THERE IS</Text>
          <Text style={[styles.phraseLine, styles.phraseAccent]}>NO TOMORROW</Text>
        </Animated.View>

        <Svg width={GRID} height={GRID} viewBox={`0 0 ${GRID} ${GRID}`} style={styles.flame}>
          <Path d={frame.d0} fill={PALETTE.shades[0]} />
          <Path d={frame.d1} fill={PALETTE.shades[1]} />
          <Path d={frame.d2} fill={PALETTE.shades[2]} />
          <Path d={frame.d3} fill={PALETTE.shades[3]} />
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
  stage: { width: STAGE_W, height: STAGE_H, alignItems: 'center', justifyContent: 'center' },

  tint: {
    position: 'absolute',
    fontFamily: Fonts.bold,
    fontSize: 68,
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
  phraseWrap: { position: 'absolute', width: STAGE_W, alignItems: 'center' },
  phraseLine: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0.5,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  phraseAccent: { color: Colors.pop },

  flame: { position: 'absolute', top: GRID_TOP, left: GRID_LEFT },

  starSlot: { position: 'absolute', width: 24, height: 24 },
  star: { width: 24, height: 24 },
});
