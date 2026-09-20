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

// ── Flame grid ───────────────────────────────────────────────────────────
// Big, chunky cells (12px) so the pixels read as deliberate GBA-era sprite
// art rather than a smooth shape that happens to be quantised.
const CELL = 12;
const COLS = 20;
const ROWS = 14;
const GRID_W = CELL * COLS;
const GRID_H = CELL * ROWS;

const STAGE_W = 240;
const STAGE_H = 280;
// The grid's bottom edge sits just under the text's baseline, so the flame
// ignites at the bottom of the letterforms rather than somewhere below them.
const GRID_TOP = STAGE_H - 104 - GRID_H;

const PALETTE = FLAME_PALETTES.pop; // outer->core: deep orange, orange, light orange, pale

// Fixed per-column silhouette — the peaks and valleys that keep this a
// flame and never a rectangle, even at full coverage. Hand-authored rather
// than noise so the shape is consistent frame to frame (a sprite, not a
// simulation); per-frame flicker is layered on top of it below.
const PROFILE = [-1, 1, 2, 0, -2, 1, 3, 2, -1, 0, 2, 3, 1, -1, 1, 2, 0, -2, 1, -1];

// Peak fill level. The flame only has to out-reach the text's top edge to
// hide it: at this level the SHORTEST possible column (level + min profile
// + min flicker = 9 - 2 - 1 = 6 rows = 72px) still clears the 66px from the
// grid's bottom to the top of the lettering. That margin is what lets the
// silhouette stay ragged at full cover instead of flattening into a block
// to guarantee coverage.
const LEVEL_MAX = 9;

type Frame = { d0: string; d1: string; d2: string; d3: string };
const EMPTY_FRAME: Frame = { d0: '', d1: '', d2: '', d3: '' };

function columnHeights(level: number, shift: number, flicker: number[]): number[] {
  // Profile/flicker scale in with the level so ignition starts as a few low
  // pixel clusters rather than instantly-full-height spikes.
  const scale = Math.min(1, level / LEVEL_MAX);
  return PROFILE.map((p, i) => {
    const h = level + (p + flicker[i]) * scale - shift;
    return Math.max(0, Math.min(ROWS, Math.round(h)));
  });
}

// Shade by distance inward from the silhouette's own edge — the classic
// pixel-fire look: cool/deep orange at the tips and outer rim, brighter
// going inward, palest deep in the body. Out-of-grid BELOW counts as solid
// so the flame's base isn't rimmed like a tip.
function buildFrame(heights: number[], embers: [number, number][]): Frame {
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
    const next = Math.min(3, depth[r][c] + 1);
    const neighbours: [number, number][] = [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]];
    for (const [nc, nr] of neighbours) {
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (!filled(nc, nr) || depth[nr][nc] !== -1) continue;
      depth[nr][nc] = next;
      queue.push([nc, nr]);
    }
  }

  // One path per shade instead of a Rect per cell — ~500 SVG nodes being
  // reconciled 20x/second was the obvious way to make this janky on a real
  // phone; four path strings is not.
  const parts = ['', '', '', ''];
  const square = (c: number, r: number) => `M${c * CELL} ${r * CELL}h${CELL}v${CELL}h-${CELL}z`;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const d = depth[r][c];
      if (d >= 0) parts[d] += square(c, r);
    }
  }
  // Detached embers riding above the tips — the scattered loose pixels in
  // the reference frames, not a particle system.
  for (const [c, r] of embers) {
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS && !filled(c, r)) parts[1] += square(c, r);
  }
  return { d0: parts[0], d1: parts[1], d2: parts[2], d3: parts[3] };
}

function randomFlicker(): number[] {
  return Array.from({ length: COLS }, () => Math.round(Math.random() * 2 - 1));
}

function randomEmbers(heights: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const c = Math.floor(Math.random() * COLS);
    const top = ROWS - heights[c];
    if (heights[c] <= 0) continue;
    out.push([c, top - 1 - Math.floor(Math.random() * 3)]);
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

// ── Timing (matches the supplied keyframes) ──────────────────────────────
const PHASE1_MS = 600;   // 0.0-0.6  TINT alone
const RISE_MS = 400;     // 0.6-1.0  ignite + rise
const HOLD_MS = 200;     // 1.0-1.2  full cover, TINT hidden, text swaps behind
const DESCEND_MS = 600;  // 1.2-1.8  flame drops away, revealing top-down
const SETTLE_MS = 200;   // 1.8-2.0  text alone
const ZOOM_MS = 500;     // 2.0-2.5  subtle zoom + stars
const STEP_MS = 45;

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

    const draw = (level: number, shift: number) => {
      const heights = columnHeights(level, shift, randomFlicker());
      setFrame(buildFrame(heights, randomEmbers(heights)));
    };

    const riseSteps = Math.round(RISE_MS / STEP_MS);
    const holdSteps = Math.round(HOLD_MS / STEP_MS);
    const descendSteps = Math.round(DESCEND_MS / STEP_MS);

    let step = 0;
    const rise = () => {
      step += 1;
      draw((LEVEL_MAX * step) / riseSteps, 0);
      if (step >= riseSteps) { step = 0; schedule(hold, STEP_MS); }
      else schedule(rise, STEP_MS);
    };

    const hold = () => {
      step += 1;
      // Keep flickering while fully covering — the silhouette stays ragged,
      // but every column is tall enough that nothing underneath shows.
      draw(LEVEL_MAX, 0);
      if (step === 1) {
        // Swap which text is live while it's completely hidden, so the
        // phrase is genuinely already there when the flame starts dropping.
        tintOpacity.setValue(0);
        phraseOpacity.setValue(1);
      }
      if (step >= holdSteps) { step = 0; schedule(descend, STEP_MS); }
      else schedule(hold, STEP_MS);
    };

    const descend = () => {
      step += 1;
      // Shift past ROWS so even the tallest peak clears the bottom.
      draw(LEVEL_MAX, ((ROWS + 4) * step) / descendSteps);
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
  stage: { width: STAGE_W, height: STAGE_H, alignItems: 'center', justifyContent: 'center' },

  tint: {
    position: 'absolute',
    fontFamily: Fonts.bold,
    fontSize: 52,
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
  phraseWrap: { position: 'absolute', width: STAGE_W, alignItems: 'center' },
  phraseLine: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0.5,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  phraseAccent: { color: Colors.pop },

  flame: { position: 'absolute', top: GRID_TOP, left: (STAGE_W - GRID_W) / 2 },

  starSlot: { position: 'absolute', width: 24, height: 24 },
  star: { width: 24, height: 24 },
});
