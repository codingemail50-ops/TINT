import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Fonts } from '../constants/theme';

interface Props {
  /** Fires once, when the sequence lands (flame gone, zoom settled). The
   *  caller decides when to navigate away — this holds on the final frame
   *  for as long as it stays mounted, so a slow boot never exposes a gap
   *  behind a self-timed fade-out. */
  onFinish: () => void;
}

const BACKGROUND = '#080808';

// Seven-step ramp, outermost first. Each successive shade is drawn as a
// smaller inset of the one before it, so the lightest necessarily covers the
// least area: dark outer edge -> orange body -> bright interior -> pale core.
const FLAME_COLORS = [
  '#782401', // outline / shadow
  '#A03201', // dark orange
  '#C44301', // burnt orange
  '#F45F01', // primary orange
  '#FB7E18', // bright orange
  '#FCC268', // light orange
  '#FDE0B0', // hottest core
];
const SHADES = FLAME_COLORS.length;

// ── Sprite grid ──────────────────────────────────────────────────────────
// 32 x 24 logical pixels, drawn as discrete squares at integer positions and
// never scaled between them, so there is nothing to anti-alias or blur.
const CELL = 9;
const COLS = 32;
const FLAME_ROWS = 24;

// FOOT is the row the flame stands on. HEADROOM is grid above the tallest
// possible lick, for detached sparks; RUNWAY is grid below the foot, there so
// the flame has somewhere to travel when it descends out of frame.
const HEADROOM = 7;
const RUNWAY = 16;
const FOOT = HEADROOM + FLAME_ROWS;
const ROWS = FOOT + RUNWAY;

const GRID_W = CELL * COLS;
const GRID_H = CELL * ROWS;
const FOOT_Y = FOOT * CELL;

const STAGE_W = 320;
const STAGE_H = GRID_H + 16;
const GRID_LEFT = (STAGE_W - GRID_W) / 2;

// Both text elements share one optical centre, so the flame that hides TINT
// hides the phrase that replaces it, and the phrase does not appear to jump.
const TEXT_MID = FOOT_Y - 48;

// ── Silhouette ───────────────────────────────────────────────────────────
// The storyboard's flame is a wave: two dominant peaks, a valley between
// them, lower shoulders falling away at the sides. MAJOR carries that shape,
// MINOR roughens the top edge into separate licks.
// Proportions solved against the glyph box rather than picked. A taller base
// band hides TINT earlier in the rise (at BASE=11 the wordmark was gone by 63%
// of the climb); a shorter one runs out of coverage margin at full height.
// These leave TINT readable through ~79% of the rise, clear it by 18px at full
// height, and still have the flame overlapping the letters by ~24px at the
// ignition beat rather than sitting under them as a separate object.
const BASE_ROWS = 4;
const PEAK_ROWS = 15;
const MINOR_ROWS = 5; // BASE + PEAK + MINOR = 24 = the sprite's full height

const MAJOR = [
  { pos: 0.10, w: 0.15, h: 0.50 },
  { pos: 0.30, w: 0.17, h: 1.00 },
  { pos: 0.50, w: 0.15, h: 0.46 },
  { pos: 0.70, w: 0.17, h: 0.95 },
  { pos: 0.90, w: 0.15, h: 0.55 },
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

// Fixed (not per-frame random) roughness, so the silhouette keeps a stable
// character frame to frame and only flickers around it.
const MINOR_AT: number[] = Array.from({ length: COLS }, (_, i) =>
  (((i * 7) % 5) / 5) * 0.62 + (((i * 13) % 3) / 3) * 0.38,
);

// ── The flame's underside ────────────────────────────────────────────────
// The flame does not stand on a straight line. Its belly is notched across
// the middle and arcs up at the shoulders. The notch depth is capped over the
// stretch the glyphs occupy — checked against the glyph box, since at zero
// margin the lettering bleeds through — and only opens up past the ends of
// the text.
const LIFT_RAGGED: number[] = Array.from({ length: COLS }, (_, i) =>
  0.55 + (((i * 11) % 7) / 7) * 0.62,
);

// A fixed notch pattern on top of the arc. Without it the middle columns all
// round to the same lift and the belly comes out flat after all — the arc term
// alone is too small there to survive rounding.
const LIFT_NOTCH: number[] = Array.from({ length: COLS }, (_, i) => (((i * 5) % 4) / 3) * 2.4);

const LIFT_AT: number[] = Array.from({ length: COLS }, (_, i) => {
  const edge = Math.abs(i / (COLS - 1) - 0.5) * 2;
  const cap = 2 + 12 * Math.max(0, Math.min(1, (edge - 0.85) / 0.15));
  const raw = (0.4 + 8 * Math.pow(edge, 2.4)) * LIFT_RAGGED[i] + LIFT_NOTCH[i];
  return Math.min(raw, cap);
});

// Fixed ignition order, so the flame catches as a broken scatter of clusters
// that fills in — an authored burn-in rather than noise flickering columns on
// and off.
const IGNITE: number[] = Array.from({ length: COLS }, (_, i) => (((i * 37) % 11) / 11) * 0.34);

// The flame starts about as wide as the TINT word and broadens as it climbs,
// which is why it can start out of the letters themselves and still be wide
// enough to hide the longer phrase by the time it reaches full height.
const CENTRE = (COLS - 1) / 2;
const SPAN_MIN = 8.4;
const SPAN_MAX = 17;
const SPAN_SOFT = 2.5; // columns over which the outer edge tapers off

type Frame = string[];
const EMPTY_FRAME: Frame = Array(SHADES).fill('');
const NO_FLAME: number[] = Array(COLS).fill(0);

/** Top edge and underside of every column, in rows above FOOT. */
function silhouette(growth: number, flicker: number[]): { top: number[]; lift: number[] } {
  const span = SPAN_MIN + (SPAN_MAX - SPAN_MIN) * growth;
  const top: number[] = [];
  const lift: number[] = [];
  for (let i = 0; i < COLS; i++) {
    const env = Math.max(0, Math.min(1, (span - Math.abs(i - CENTRE)) / SPAN_SOFT));
    if (env <= 0 || growth <= IGNITE[i]) { top.push(0); lift.push(0); continue; }
    const g = Math.min(1, (growth - IGNITE[i]) / (1 - IGNITE[i]));
    const t = (BASE_ROWS + PEAK_ROWS * MAJOR_AT[i] + MINOR_ROWS * MINOR_AT[i] + flicker[i]) * g * env;
    top.push(Math.max(0, Math.round(t)));
    lift.push(Math.round(LIFT_AT[i] * g));
  }
  return { top, lift };
}

// How much a column defers to its shorter neighbours, per shade. The hotter
// the shade the more it defers, so the hot end falls away near the flame's
// left and right extremes instead of running clean across the base as a
// horizontal band. Vertical insetting alone cannot produce a core — every
// column's lowest cells are its hottest, so the hot shade spans the full
// width by construction.
const LAYER_BIAS = [0, 0.4, 0.45, 0.55, 0.65, 0.78, 0.9];

/** Each hotter shade is the body shrunk — vertically by a fraction of the
 *  column's own thickness, horizontally by a minimum over neighbours. Pure min
 *  flattens every inner band into a plateau (the flame reads as a layer cake);
 *  blending it back toward the column's own thickness keeps the bands
 *  undulating with the licks while still starving a lone tall spike of its
 *  inner shades, so narrow licks stay dark all the way up. */
function shrink(thick: number[], k: number, scale: number, bias: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) {
    let m = Infinity;
    for (let d = -k; d <= k; d++) {
      const i = c + d;
      m = Math.min(m, i < 0 || i >= COLS ? 0 : thick[i]);
    }
    const v = bias * m + (1 - bias) * thick[c];
    out.push(Math.max(0, Math.round(v * scale)));
  }
  return out;
}

// Inset of each shade, from the outline inwards.
const LAYER_SCALE = [1, 0.84, 0.68, 0.54, 0.40, 0.26, 0.12];
// The hotter the shade, the wider the neighbourhood it has to agree with, so
// the pale core narrows horizontally as well as vertically and stays the
// smallest region on screen rather than a band across the whole base.
const LAYER_SPREAD = [0, 1, 1, 2, 2, 3, 4];

type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number };

// How many sparks the flame throws off at the instant it starts descending,
// and how often it throws one the rest of the time. The ambient rate is kept
// low deliberately: the burst is what should read as the moment.
const BURST_COUNT = 12;
const AMBIENT_RATE = 0.3;

// `shift` moves the flame's body down the screen every tick as it descends.
// Sparks must NOT ride along with it after they're released — a released
// ember floats free of the fire, it doesn't keep sinking with it — so their
// `y` is absolute screen space, with `shift` baked in once at spawn (see
// spawnSpark/burstSparks) rather than re-added here on every render.
function buildFrame(top: number[], lift: number[], shift: number, sparks: Spark[]): Frame {
  const thick = top.map((t, i) => Math.max(0, t - lift[i]));
  const inner: number[][] = [thick];
  for (let k = 1; k < SHADES; k++) inner.push(shrink(thick, LAYER_SPREAD[k], LAYER_SCALE[k], LAYER_BIAS[k]));

  const parts: string[] = Array(SHADES).fill('');
  const square = (c: number, r: number) => `M${c * CELL} ${r * CELL}h${CELL}v${CELL}h-${CELL}z`;

  for (let c = 0; c < COLS; c++) {
    const t0 = top[c];
    const b0 = lift[c];
    for (let above = b0 + 1; above <= t0; above++) {
      const r = FOOT - above + shift;
      if (r < 0 || r >= ROWS) continue;
      // Shade by where the cell sits in the column as a FRACTION of that
      // column's own thickness, not by a fixed number of cells inset from the
      // edge. Insetting by whole cells means a column thinner than seven cells
      // cannot reach the hot end of the ramp at all, which is why the flame
      // came out as a flat brown stub at ignition instead of a small fire.
      const depth = above - b0;
      let shade = 0;
      for (let k = SHADES - 1; k >= 1; k--) {
        if (depth <= inner[k][c]) { shade = k; break; }
      }
      // One dark cell along the underside wherever the flame has lifted off,
      // so the belly is outlined rather than showing a pale cut edge.
      if (depth === 1 && b0 > 0 && b0 !== lift[c > 0 ? c - 1 : c + 1]) shade = 0;
      parts[shade] += square(c, r);
    }
  }

  for (const s of sparks) {
    const frac = s.age / s.life;
    // Sparks cool as they travel: pale at the tip, dark by the end.
    const head = Math.max(0, SHADES - 1 - Math.round(frac * (SHADES - 1)));
    // Head plus two dimmer cells trailing back along -velocity. The streak is
    // what makes them read as sparks thrown off the fire rather than
    // unrelated floating dots — a lone pixel has no direction.
    // s.y is already an absolute screen row (the descent's shift was baked
    // in once, at spawn) — it must NOT also have the current tick's `shift`
    // added here, or every spark still in flight gets dragged down again on
    // every subsequent tick as the flame keeps sinking, fighting its own
    // upward vy instead of floating free of the flame once released.
    let pc = -99;
    let pr = -99;
    for (let step = 0; step < 3; step++) {
      const c = Math.round(s.x - s.vx * step * 1.4);
      const r = Math.round(s.y - s.vy * step * 1.4);
      if (c === pc && r === pr) continue;
      pc = c;
      pr = r;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      parts[Math.max(0, head - step * 2)] += square(c, r);
    }
  }

  return parts;
}

function randomFlicker(): number[] {
  return Array.from({ length: COLS }, () => Math.round(Math.random() * 2 - 1));
}

/** Throws a spark off the flame's top edge — at its CURRENT on-screen
 *  position, `shift` cells down from where it started, not from the fixed
 *  spot the flame occupied before it began descending. Without `shift` baked
 *  in here, every spark would spawn back up at the top of the frame no
 *  matter how far the fire had already sunk, instead of coming from the
 *  tip's actual position. Most drift more or less straight up and burn out
 *  quickly; a minority get real lateral speed and a longer life, and those
 *  few are the ones still streaking once the fire has gone. */
function spawnSpark(top: number[], lift: number[], shift: number, flyer = Math.random() < 0.3): Spark | null {
  const c = Math.floor(Math.random() * COLS);
  if (top[c] <= lift[c]) return null;
  return {
    x: c,
    // One cell clear of the flame's own topmost filled pixel, not on it. A
    // spark spawned AT that coordinate overlaps the flame's own tip
    // highlighting (which is already near-pale there) and reads as part of
    // the fire's own texture until it has drifted away — a gap the eye
    // reads as a delay even though it spawned on the right tick. `shift` is
    // baked in once, here, at spawn — see the note in buildFrame for why it
    // must not be added again on every later render.
    y: FOOT - top[c] - 1 + shift,
    vx: (Math.random() - 0.5) * (flyer ? 0.9 : 0.3),
    vy: -(0.18 + Math.random() * (flyer ? 0.45 : 0.28)),
    age: 0,
    life: flyer ? 20 + Math.random() * 14 : 8 + Math.random() * 10,
  };
}

/** The release that reads as the fire throwing off sparks as it lets go.
 *  It fires on the tick the descent starts: spread along the flame's top edge
 *  rather than at random columns, and all long-lived, so the outflow is an
 *  event the eye ties to the flame moving rather than something that only
 *  becomes visible later as slow stragglers accumulate. */
function burstSparks(top: number[], lift: number[], shift: number): Spark[] {
  const out: Spark[] = [];
  for (let i = 0; i < BURST_COUNT; i++) {
    const c = Math.round(((i + 0.5) / BURST_COUNT) * (COLS - 1));
    if (top[c] <= lift[c]) continue;
    out.push({
      x: c,
      y: FOOT - top[c] - 1 + shift, // same clearance + shift as spawnSpark, see there
      vx: (Math.random() - 0.5) * 1.0,
      vy: -(0.35 + Math.random() * 0.45),
      age: 0,
      life: 18 + Math.random() * 14,
    });
  }
  return out;
}

function stepSparks(sparks: Spark[]): Spark[] {
  const out: Spark[] = [];
  for (const s of sparks) {
    const next: Spark = { ...s, x: s.x + s.vx, y: s.y + s.vy, vy: s.vy * 0.985, age: s.age + 1 };
    if (next.age > next.life) continue;
    if (next.y < -2 || next.x < -2 || next.x > COLS + 2) continue;
    out.push(next);
  }
  return out;
}

// ── Timeline ─────────────────────────────────────────────────────────────
const PHASE1_MS = 600;  // 0.00-0.60  TINT alone, static
const RISE_MS = 500;    // 0.60-1.10  flame grows up through the letters
const HOLD_MS = 300;    // 1.10-1.40  full cover; the phrase swaps in behind it
const DESCEND_MS = 500; // 1.40-1.90  flame travels down, revealing top to bottom
const SETTLE_MS = 100;  // 1.90-2.00  flame gone
const ZOOM_MS = 500;    // 2.00-2.50  phrase scales 100% -> 106%
const STEP_MS = 45;

const T_RISE = PHASE1_MS;
const T_HOLD = T_RISE + RISE_MS;
const T_DESCEND = T_HOLD + HOLD_MS;
const T_SETTLE = T_DESCEND + DESCEND_MS;
const T_ZOOM = T_SETTLE + SETTLE_MS;
const T_END = T_ZOOM + ZOOM_MS;

// Far enough that the tallest lick clears the bottom of the grid.
const MAX_SHIFT = ROWS - HEADROOM + 2;

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
    let burst = false;
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
        // Swapped while completely hidden, so the phrase genuinely already
        // exists behind the flame when it starts moving. TINT does not return.
        swapped = true;
        tintOpacity.setValue(0);
        phraseOpacity.setValue(1);
      }

      if (alight) {
        const { top, lift } = silhouette(growth, randomFlicker());
        sparks = stepSparks(sparks);
        if (t >= T_DESCEND && !burst) {
          // On the very tick the flame starts moving down, so the outflow
          // reads as caused by it. Everything before this is a low ambient
          // trickle; without the burst the sparks only became noticeable
          // later, as slow ones piled up, which is the lag.
          burst = true;
          sparks.push(...burstSparks(top, lift, shift));
        }
        // Keep a trickle going into the descent — those spawn at the fire's
        // CURRENT position (shift baked in below), so as the tip keeps
        // sinking, newly released sparks keep originating from wherever it
        // actually is now rather than from where it started. Only the last
        // stretch stops, so the tail end isn't dragged off the bottom with
        // the flame.
        if (shift < MAX_SHIFT * 0.75 && Math.random() < AMBIENT_RATE) {
          const s = spawnSpark(top, lift, shift);
          if (s) sparks.push(s);
        }
        setFrame(buildFrame(top, lift, shift, sparks));
      } else {
        // Flame gone; the handful of sparks it threw are still in the air.
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
        }).start(() => {
          // The screen only actually switches once boot's own async user/
          // session check also resolves (see the comment on bootTargetScreen
          // in AppNavigator) -- on a slow network that can run past T_END,
          // and this animation was leaving the zoomed phrase sitting
          // completely still for however long that took, which read as the
          // splash having frozen/hung rather than still working. A slow
          // breathing loop keeps it visibly alive for however long the wait
          // turns out to be, instead of a dead frame.
          if (cancelled) return;
          Animated.loop(
            Animated.sequence([
              Animated.timing(phraseScale, { toValue: 1.09, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(phraseScale, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
          ).start();
        });
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
          <Text style={styles.phraseLine}>NO TOMORROW</Text>
        </Animated.View>

        <Svg width={GRID_W} height={GRID_H} viewBox={`0 0 ${GRID_W} ${GRID_H}`} style={styles.flame}>
          {FLAME_COLORS.map((color, i) => (
            <Path key={color} d={frame[i]} fill={color} />
          ))}
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKGROUND,
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
    color: '#FFFFFF',
  },
  phraseWrap: { position: 'absolute', top: TEXT_MID - 26, width: STAGE_W, alignItems: 'center' },
  phraseLine: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.5,
    textAlign: 'center',
    color: '#FFFFFF',
  },

  flame: { position: 'absolute', top: 0, left: GRID_LEFT },
});
