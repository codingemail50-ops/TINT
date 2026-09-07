import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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

// ── Wide flame, built from overlapping tapered tongues ──────────────────
// Each column is a real flame silhouette (curved sides, pointed tip), not a
// flat-topped bar — stacking bars by height read as a bar chart rather than
// fire. Neighboring tongues overlap at the base so the wildfire reads as one
// continuous blaze that splits into individual licks near the tips, and each
// tongue is itself a nested stack of 4 smaller tongues (outer deep-orange
// down to a pale core), giving every lick its own base-to-tip gradient
// instead of one hard color band shared across the whole row.
const FLAME_WIDTH = 264;
const MAX_FLAME_HEIGHT = 156;
const FLAME_COLS = 22;
const COL_WIDTH = FLAME_WIDTH / FLAME_COLS;
const TONGUE_WIDTH = COL_WIDTH * 1.55; // > COL_WIDTH so bases merge, tips stay separate

// A jagged, multi-peaked silhouette (relative height per column, 0..1) —
// hand-authored rather than a smooth curve, for the blocky wildfire look
// from the reference rather than a single torch-shaped flame.
const FLAME_PROFILE = [
  0.5, 0.72, 0.58, 0.88, 0.62, 1.0, 0.68, 0.82, 0.58, 0.94,
  0.7, 0.78, 0.56, 1.0, 0.74, 0.6, 0.9, 0.66, 0.84, 0.58, 0.92, 0.64,
];

// Nested-layer sizing (outer -> core) and their matching palette shades.
const LAYER_SCALES = [1, 0.76, 0.53, 0.3];

// A teardrop tapering to a point at the tip, bulging outward through the
// middle, flat across the base — the classic flame-lick silhouette. `lean`
// skews the tip sideways for a hand-flickered, non-symmetric look.
function tonguePath(cx: number, baseY: number, w: number, h: number, lean: number): string {
  const halfW = w / 2;
  const tipX = cx + lean;
  const tipY = baseY - h;
  const bulgeY = baseY - h * 0.62;
  const midY = baseY - h * 0.3;
  return `M ${cx - halfW} ${baseY} `
    + `C ${cx - halfW * 1.05} ${midY}, ${cx - halfW * 0.35 + lean * 0.4} ${bulgeY}, ${tipX} ${tipY} `
    + `C ${cx + halfW * 0.35 + lean * 0.4} ${bulgeY}, ${cx + halfW * 1.05} ${midY}, ${cx + halfW} ${baseY} Z`;
}

const WideFlame: React.FC<{ growth: number; jitter: number[] }> = ({ growth, jitter }) => (
  <Svg width={FLAME_WIDTH} height={MAX_FLAME_HEIGHT} viewBox={`0 0 ${FLAME_WIDTH} ${MAX_FLAME_HEIGHT}`} style={styles.flameRow} pointerEvents="none">
    {FLAME_PROFILE.map((p, col) => {
      const height = MAX_FLAME_HEIGHT * growth * p * jitter[col];
      if (height < 2) return null;
      const cx = COL_WIDTH * (col + 0.5);
      const lean = (jitter[col] - 1) * height * 0.35;
      return (
        <React.Fragment key={col}>
          {LAYER_SCALES.map((scale, layer) => (
            <Path
              key={layer}
              d={tonguePath(cx, MAX_FLAME_HEIGHT, TONGUE_WIDTH * scale, height * scale, lean)}
              fill={PALETTE.shades[layer]}
            />
          ))}
        </React.Fragment>
      );
    })}
  </Svg>
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

  flameRow: { position: 'absolute', left: 0, bottom: 0 },

  tagline: {
    fontFamily: Fonts.pixel, fontSize: 20, color: Colors.gray[400],
    letterSpacing: 1, textTransform: 'uppercase',
  },
});
