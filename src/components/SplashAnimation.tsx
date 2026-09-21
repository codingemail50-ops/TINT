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
// 36 cells across at roughly 1/6 the lettering's cap height: chunky enough to
// read as sprite art, fine enough to form licks instead of a blocky skyline.
const CELL = 8;
const COLS = 36;

// FOOT is the row the flame rests on. RUNWAY is dead grid below it, there so
// the flame has somewhere to travel when it descends — the reference has it
// slide down and out of frame, not shrink away on the spot.
const FOOT = 33;
const RUNWAY = 14;
const ROWS = FOOT + RUNWAY;

const GRID_W = CELL * COLS; // 288 — wider than "NO TOMORROW", so the phrase
const GRID_H = CELL * ROWS; // can never poke out past the flame's sides
const FOOT_Y = FOOT * CELL;

const STAGE_W = 320;
const STAGE_H = GRID_H + 16;
const GRID_LEFT = (STAGE_W - GRID_W) / 2;

// The lettering is placed by hand rather than centred in the stage, and sized
// against the flame rather than for its own sake: the glyphs span roughly
// 55%-95% of the flame's thinnest column, so the rising fire crosses them over
// the second half of the rise (readable at 50% grown, half gone at 70%, clear
// only on the last beat) and still closes over them completely.
const TEXT_MID = FOOT_Y - 78;

const PALETTE = FLAME_PALETTES.pop; // deep orange -> orange -> light orange -> pale

// ── Silhouette ───────────────────────────────────────────────────────────
// The reference flame is a wave, not a row of even tongues: two dominant
// peaks with a deep notch between them and lower shoulders falling away at
// the sides. MAJOR carries that shape; MINOR roughens the top edge into licks.
const BASE_ROWS = 10;
const PEAK_ROWS = 13;
const MINOR_ROWS = 3;

const MAJOR = [
  { pos: 0.10, w: 0.14, h: 0.55 },
  { pos: 0.29, w: 0.16, h: 1.00 },
  { pos: 0.50, w: 0.14, h: 0.52 },
  { pos: 0.71, w: 0.16, h: 0.94 },
  { pos: 0.90, w: 0.14, h: 0.60 },
];

// Parabolic falloff per lobe, max-combined: each peak narrows to a 1-2 cell
// tip and widens as it descends, so they read as licks rather than bars.
const MAJOR_AT: number[] = Array.from({ length: COLS }, (_, i) => {
  const frac = i / (COLS - 1);
  let best = 0;
  for (const m of MAJOR) {
    const d = Math.abs(frac - m.pos) / m.w;
    if (d >= 1) continue;
    const v = m.h * (1 - d * d);
    if (v > best) best = v;
  }
  return best;
});

// Fixed (not per-frame random) roughness, so the silhouette has a stable
// character frame to frame and only flickers around it.
const MINOR_AT: number[] = Array.from({ length: COLS }, (_, i) =>
  (((i * 7) % 5) / 5) * 0.62 + (((i * 13) % 3) / 3) * 0.38,
);

// ── The flame's underside ────────────────────────────────────────────────
// This is the "whoosh": the flame does NOT sit on a straight line. Its belly
// arcs up hard at the shoulders and is notched all the way across, so it reads
// as a body of fire sweeping through frame rather than a bar rising out of the
// floor. LIFT is capped in the middle — the stretch that has to stay under the
// lettering — and only opens up past the ends of the text.
const LIFT_RAGGED: number[] = Array.from({ length: COLS }, (_, i) =>
  0.62 + (((i * 11) % 7) / 7) * 0.58,
);

// ...but only outside the lettering. Across the stretch the glyphs occupy, the
// belly is capped low enough to stay under them (checked against the glyph box,
// not eyeballed — at 0 margin the text bleeds through the notches); past the
// ends of the text the cap opens up and the flame can lift away freely.
const LIFT_CAP: number[] = Array.from({ length: COLS }, (_, i) => {
  const edge = Math.abs(i / (COLS - 1) - 0.5) * 2;
  return 5 + 12 * Math.max(0, Math.min(1, (edge - 0.78) / 0.22));
});

const LIFT_AT: number[] = Array.from({ length: COLS }, (_, i) => {
  const edge = Math.abs(i / (COLS - 1) - 0.5) * 2;
  const raw = (1.2 + 9 * Math.pow(edge, 2.2)) * LIFT_RAGGED[i];
  return Math.min(raw, LIFT_CAP[i]);
});

// Fixed ignition order, so the flame catches as a broken scatter of clusters
// that fills in — an authored burn-in rather than noise flickering columns on
// and off. This is keyframe 2.
const IGNITE: number[] = Array.from({ length: COLS }, (_, i) => (((i * 37) % 11) / 11) * 0.34);

type Frame = { d0: string; d1: string; d2: string; d3: string };
const EMPTY_FRAME: Frame = { d0: '', d1: '', d2: '', d3: '' };
const NO_FLAME: number[] = Array(COLS).fill(0);

/** Top edge and underside of every column, in rows above FOOT. */
function silhouette(growth: number, flicker: number[]): { top: number[]; lift: number[] } {
  const top: number[] = [];
  const lift: number[] = [];
  for (let i = 0; i < COLS; i++) {
    if (growth <= IGNITE[i]) { top.push(0); lift.push(0); continue; }
    const g = Math.min(1, (growth - IGNITE[i]) / (1 - IGNITE[i]));
    const t = (BASE_ROWS + PEAK_ROWS * MAJOR_AT[i] + MINOR_ROWS * MINOR_AT[i] + flicker[i]) * g;
    const l = LIFT_AT[i] * g;
    top.push(Math.max(0, Math.round(t)));
    lift.push(Math.round(l));
  }
  return { top, lift };
}

const NARROW_BIAS = 0.6; // how much a column defers to its shorter neighbours

/** Each hotter shade is the body shrunk — vertically by a fraction of the
 *  column's own thickness, horizontally by a minimum over neighbours. Pure min
 *  flattens every inner band into a plateau (the flame reads as a layer cake);
 *  blending it back toward the column's own thickness keeps the bands
 *  undulating with the licks while still starving a lone tall spike of its
 *  inner shades, so narrow licks stay deep orange all the way up. */
function shrink(thick: number[], k: number, scale: number, drop: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) {
    let m = Infinity;
    for (let d = -k; d <= k; d++) {
      const i = c + d;
      m = Math.min(m, i < 0 || i >= COLS ? 0 : thick[i]);
    }
    const v = NARROW_BIAS * m + (1 - NARROW_BIAS) * thick[c];
    out.push(Math.max(0, Math.round(v * scale - drop)));
  }
  return out;
}

type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number };

function buildFrame(top: number[], lift: number[], shift: number, sparks: Spark[]): Frame {
  const thick = top.map((t, i) => Math.max(0, t - lift[i]));
  const inner = [thick, shrink(thick, 1, 0.8, 1), shrink(thick, 1, 0.55, 1), shrink(thick, 2, 0.32, 1)];

  const parts = ['', '', '', ''];
  const square = (c: number, r: number) => `M${c * CELL} ${r * CELL}h${CELL}v${CELL}h-${CELL}z`;

  for (let c = 0; c < COLS; c++) {
    const t0 = top[c];
    const b0 = lift[c];
    for (let above = b0 + 1; above <= t0; above++) {
      const r = FOOT - above + shift;
      if (r < 0 || r >= ROWS) continue;
      let shade = 0;
      for (let k = 3; k >= 1; k--) {
        // Inset from the underside too, so the belly carries a rim rather
        // than showing a pale edge where it lifts off.
        if (above > b0 + k && above <= b0 + inner[k][c]) { shade = k; break; }
      }
      parts[shade] += square(c, r);
    }
  }

  for (const s of sparks) {
    const frac = s.age / s.life;
    // Sparks cool as they travel: pale at the tip, deep orange by the end.
    const head = frac < 0.25 ? 3 : frac < 0.55 ? 2 : frac < 0.8 ? 1 : 0;
    // Head, plus two dimmer cells trailing back along -velocity. The streak is
    // what makes them read as sparks thrown off the fire rather than unrelated
    // floating dots — a lone pixel has no direction.
    let pc = -99;
    let pr = -99;
    for (let step = 0; step < 3; step++) {
      const c = Math.round(s.x - s.vx * step * 1.4);
      const r = Math.round(s.y - s.vy * step * 1.4) + shift;
      if (c === pc && r === pr) continue;
      pc = c;
      pr = r;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      parts[Math.max(0, head - step)] += square(c, r);
    }
  }

  return { d0: parts[0], d1: parts[1], d2: parts[2], d3: parts[3] };
}

function randomFlicker(): number[] {
  return Array.from({ length: COLS }, () => Math.round(Math.random() * 2 - 1));
}

/** Throws a spark off the flame's top edge. Most drift more or less straight
 *  up; a minority get real lateral speed and a long life, and those are the
 *  ones still streaking diagonally across the frame after the fire has gone. */
function spawnSpark(top: number[], lift: number[]): Spark | null {
  const c = Math.floor(Math.random() * COLS);
  if (top[c] <= lift[c]) return null;
  const flyer = Math.random() < 0.3;
  return {
    x: c,
    y: FOOT - top[c],
    vx: (Math.random() - 0.5) * (flyer ? 0.9 : 0.3),
    vy: -(0.18 + Math.random() * (flyer ? 0.45 : 0.28)),
    age: 0,
    life: flyer ? 26 + Math.random() * 16 : 10 + Math.random() * 10,
  };
}

function stepSparks(sparks: Spark[]): Spark[] {
  const out: Spark[] = [];
  for (const s of sparks) {
    const next: Spark = {
      ...s,
      x: s.x + s.vx,
      y: s.y + s.vy,
      vy: s.vy * 0.985,
      age: s.age + 1,
    };
    if (next.age > next.life) continue;
    if (next.y < -2 || next.x < -2 || next.x > COLS + 2) continue;
    out.push(next);
  }
  return out;
}

// ── Timing (from the keyframe captions) ──────────────────────────────────
const PHASE1_MS = 600;  // 0.0-0.6  TINT alone
const RISE_MS = 400;    // 0.6-1.0  ignite + rise
const HOLD_MS = 200;    // 1.0-1.2  full cover, text swaps behind
const DESCEND_MS = 600; // 1.2-1.8  flame travels down and out of frame
const SETTLE_MS = 200;  // 1.8-2.0  text alone, last sparks still flying
const ZOOM_MS = 500;    // 2.0-2.5  subtle zoom
const STEP_MS = 45;

const T_RISE = PHASE1_MS;
const T_HOLD = T_RISE + RISE_MS;
const T_DESCEND = T_HOLD + HOLD_MS;
const T_SETTLE = T_DESCEND + DESCEND_MS;
const T_ZOOM = T_SETTLE + SETTLE_MS;
const T_END = T_ZOOM + ZOOM_MS;

// Far enough that the tallest lick clears the bottom of the grid.
const MAX_SHIFT = RUNWAY + BASE_ROWS + PEAK_ROWS + MINOR_ROWS + 2;

export const SplashAnimation: React.FC<Props> = ({ onFinish }) => {
  const [frame, setFrame] = useState<Frame>(EMPTY_FRAME);
  const tintOpacity = useRef(new Animated.Value(1)).current;
  const phraseOpacity = useRef(new Animated.Value(0)).current;
  const phraseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let sparks: Spark[] = [];
    let swapped = false;
    let zoomed = false;
    const started = Date.now();

    const tick = () => {
      if (cancelled) return;
      const t = Date.now() - started;

      let growth = 0;
      let shift = 0;
      let alight = false;
      if (t >= T_RISE && t < T_HOLD) {
        growth = (t - T_RISE) / RISE_MS;
        alight = true;
      } else if (t >= T_HOLD && t < T_DESCEND) {
        growth = 1;
        alight = true;
      } else if (t >= T_DESCEND && t < T_SETTLE) {
        growth = 1;
        shift = Math.round((MAX_SHIFT * (t - T_DESCEND)) / DESCEND_MS);
        alight = true;
      }

      if (t >= T_HOLD && !swapped) {
        // Swapped while completely hidden, so the phrase is genuinely already
        // behind the flame when it starts moving.
        swapped = true;
        tintOpacity.setValue(0);
        phraseOpacity.setValue(1);
      }

      if (alight) {
        const { top, lift } = silhouette(growth, randomFlicker());
        sparks = stepSparks(sparks);
        // Keep throwing sparks well into the descent — those come off a flame
        // that is already below the lettering, so they fly up through and
        // around it, which is what the reference shows once the fire has gone.
        // Only the last stretch stops, so the tail end isn't dragged off the
        // bottom with the flame.
        if (shift < MAX_SHIFT * 0.75) {
          const n = Math.random() < 0.75 ? 1 : 2;
          for (let i = 0; i < n; i++) {
            const s = spawnSpark(top, lift);
            if (s) sparks.push(s);
          }
        }
        setFrame(buildFrame(top, lift, shift, sparks));
      } else {
        // Flame gone; the sparks it threw are still in the air.
        sparks = stepSparks(sparks);
        setFrame(sparks.length ? buildFrame(NO_FLAME, NO_FLAME, 0, sparks) : EMPTY_FRAME);
      }

      if (t >= T_ZOOM && !zoomed) {
        zoomed = true;
        Animated.timing(phraseScale, {
          toValue: 1.06,
          duration: ZOOM_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      }

      if (t >= T_END) { onFinish(); return; }
      timer = setTimeout(tick, STEP_MS);
    };

    timer = setTimeout(tick, STEP_MS);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root} pointerEvents="none">
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
});
