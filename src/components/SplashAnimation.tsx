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
// 36 cells across at roughly 1/6 the lettering's cap height, matching the
// reference frames: chunky enough to read as sprite art, fine enough to
// actually form tongues instead of a blocky skyline.
const CELL = 8;
const COLS = 36;
const ROWS = 33;
const GRID_W = CELL * COLS; // 288 — comfortably wider than "NO TOMORROW", so
const GRID_H = CELL * ROWS; // the phrase can never poke out past the flame's sides

const STAGE_W = 320;
const STAGE_H = 300;
const GRID_LEFT = (STAGE_W - GRID_W) / 2;

// The lettering is placed by hand rather than centred in the stage, and sized
// against the base band rather than for its own sake. The band's final height
// is BASE_ROWS*CELL; the glyphs are set to span from ~50% to ~89% of it, so the
// rising coverage front crosses them over the second half of the rise (readable
// at 60% grown, half gone at 70%, clear only in the last beat) and the band
// still closes over them completely with room to spare.
const TEXT_MID = GRID_H - 78;

const PALETTE = FLAME_PALETTES.pop; // deep orange -> orange -> light orange -> pale

// Solid band under the tongues. Sized so the *shortest* column of the full
// flame (base + the smallest tongue value, minus a row of flicker) still
// clears the top of the glyphs by ~10px — which is precisely why the
// silhouette above it is free to stay as ragged as the reference: coverage
// never depends on the top edge flattening out. Raising it further would
// only make the flame swallow the wordmark earlier in the rise.
const BASE_ROWS = 12;
const PEAK_ROWS = 13;

// Nine tongues, deliberately uneven: tallest is ~1.9x the shortest, and
// they're narrow enough not to blend into one dome, so the valleys between
// them fall to ~40% of peak height.
const TONGUES = [
  { pos: 0.06, w: 0.065, h: 0.52 },
  { pos: 0.17, w: 0.070, h: 0.80 },
  { pos: 0.28, w: 0.060, h: 0.58 },
  { pos: 0.39, w: 0.075, h: 1.00 },
  { pos: 0.50, w: 0.062, h: 0.68 },
  { pos: 0.61, w: 0.072, h: 0.90 },
  { pos: 0.72, w: 0.058, h: 0.55 },
  { pos: 0.83, w: 0.068, h: 0.82 },
  { pos: 0.93, w: 0.062, h: 0.60 },
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
  return edge === 0 ? 0.45 : edge === 1 ? 0.68 : edge === 2 ? 0.86 : 1;
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

/** Each hotter shade is the whole silhouette shrunk — vertically by a
 *  fraction of each column's own height, horizontally by taking the minimum
 *  over a window of neighbours. Shrinking proportionally (rather than insetting
 *  by a fixed number of cells, which is what depth-from-edge does) is what
 *  makes the distribution match the reference: a narrow tongue's neighbours are
 *  short, so the min wipes its inner shades out and it stays deep orange all
 *  the way up, while only the broad lower mass is wide and tall enough to carry
 *  the pale core. */
const NARROW_BIAS = 0.6; // how much a column defers to its shorter neighbours

function shrink(heights: number[], k: number, scale: number, drop: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) {
    let m = Infinity;
    for (let d = -k; d <= k; d++) {
      const i = c + d;
      m = Math.min(m, i < 0 || i >= COLS ? 0 : heights[i]);
    }
    // Pure min flattens every inner band into a horizontal plateau (the whole
    // flame reads as a layer cake). Blending it back toward the column's own
    // height keeps the bands undulating with the tongues while still starving
    // a lone tall spike of its inner shades.
    const v = NARROW_BIAS * m + (1 - NARROW_BIAS) * heights[c];
    out.push(Math.max(0, Math.round(v * scale - drop)));
  }
  return out;
}

function buildFrame(heights: number[], embers: [number, number][]): Frame {
  const layers = [
    heights,
    shrink(heights, 1, 0.80, 1),
    shrink(heights, 1, 0.55, 1),
    shrink(heights, 2, 0.32, 1),
  ];

  const parts = ['', '', '', ''];
  const square = (c: number, r: number) => `M${c * CELL} ${r * CELL}h${CELL}v${CELL}h-${CELL}z`;

  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS - heights[c]; r < ROWS; r++) {
      let shade = 0;
      for (let k = 3; k >= 1; k--) {
        if (r >= ROWS - layers[k][c]) { shade = k; break; }
      }
      parts[shade] += square(c, r);
    }
  }

  for (const [c, r] of embers) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
    if (r >= ROWS - heights[c]) continue;
    // Higher embers are cooler.
    const tip = ROWS - heights[c];
    parts[tip - r > 3 ? 0 : 1] += square(c, r);
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
  const count = Math.round(2 + 9 * intensity);
  for (let i = 0; i < count; i++) {
    const c = Math.floor(Math.random() * COLS);
    if (heights[c] <= 0) continue;
    const tip = ROWS - heights[c];
    const rise = 1 + Math.floor(Math.random() * Math.random() * 6);
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

        <Svg width={GRID_W} height={GRID_H} viewBox={`0 0 ${GRID_W} ${GRID_H}`} style={styles.flame}>
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
  stage: { width: STAGE_W, height: STAGE_H },

  tint: {
    position: 'absolute',
    top: TEXT_MID - 30,
    width: STAGE_W,
    textAlign: 'center',
    fontFamily: Fonts.bold,
    fontSize: 60,
    lineHeight: 60,
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
  phraseWrap: { position: 'absolute', top: TEXT_MID - 26, width: STAGE_W, alignItems: 'center' },
  phraseLine: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.5,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  phraseAccent: { color: Colors.pop },

  flame: { position: 'absolute', top: 0, left: GRID_LEFT },

  starSlot: { position: 'absolute', width: 24, height: 24 },
  star: { width: 24, height: 24 },
});
