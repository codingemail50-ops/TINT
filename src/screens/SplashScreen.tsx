import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Colors, Fonts } from '../constants/theme';
import { FLAME_FRAMES, FLAME_COLS, FLAME_ROWS, FLAME_PALETTES } from '../components/flameShapes';

// Boot-time brand moment: "TINT" appears dim/unlit, a pixel flame climbs it
// from the bottom, igniting the letters as it passes (a stepped, blocky
// reveal — not a particle effect, on purpose), then a smooth crossfade into
// the "There is no tomorrow" wordmark, which holds until the real app is
// ready underneath. Strictly black/white/grey/orange, matching the rest of
// the app — no borrowed neon palette from the moodboard, just its pixel
// typography/layout ideas (the dotted top/bottom borders).

const TITLE_SIZE = 84;
const TITLE_HEIGHT = 96;
const FLAME_SIZE = 46;
const BURN_STEPS = 12;
const STEP_MS = 150;
const HOLD_AFTER_BURN_MS = 400;
const CROSSFADE_MS = 550;
const DOT_COUNT = 16;

const PALETTE = FLAME_PALETTES.pop;

// A bespoke, minimal flame renderer — deliberately not the shared
// PixelFlame component, which layers drifting ember sparks on top of the
// pixel grid. This is exactly the raw grid, cycling frames on a fixed
// interval: pixel-by-pixel, no particles.
const MiniFlame: React.FC<{ frameIndex: number; size: number }> = ({ frameIndex, size }) => {
  const frame = FLAME_FRAMES[frameIndex % FLAME_FRAMES.length];
  const height = (size / FLAME_COLS) * FLAME_ROWS;
  return (
    <Svg width={size} height={height} viewBox={`0 0 ${FLAME_COLS} ${FLAME_ROWS}`}>
      {frame.outline.map((c, i) => (
        <Rect key={`o${i}`} x={c.x} y={c.y} width={1} height={1} fill={PALETTE.outline} />
      ))}
      {frame.cells.map((c, i) => (
        <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={PALETTE.shades[c.shade - 1]} />
      ))}
    </Svg>
  );
};

const DotRow: React.FC<{ position: 'top' | 'bottom' }> = ({ position }) => (
  <View style={[dotStyles.row, position === 'top' ? { top: 32 } : { bottom: 32 }]}>
    {Array.from({ length: DOT_COUNT }).map((_, i) => (
      <View key={i} style={[dotStyles.dot, i % 4 === 0 && dotStyles.dotPop]} />
    ))}
  </View>
);

type Phase = 'burning' | 'burned' | 'transitioning' | 'done';

export const SplashScreen: React.FC = () => {
  const [burnStep, setBurnStep] = useState(0);
  const [flameFrame, setFlameFrame] = useState(0);
  const [phase, setPhase] = useState<Phase>('burning');
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let step = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      step += 1;
      setBurnStep(Math.min(step, BURN_STEPS));
      setFlameFrame(f => f + 1);

      if (step >= BURN_STEPS) {
        setPhase('burned');
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          setPhase('transitioning');
          Animated.parallel([
            Animated.timing(titleOpacity, { toValue: 0, duration: CROSSFADE_MS, useNativeDriver: true }),
            Animated.timing(taglineOpacity, { toValue: 1, duration: CROSSFADE_MS, useNativeDriver: true }),
          ]).start(({ finished }) => { if (finished && !cancelled) setPhase('done'); });
        }, HOLD_AFTER_BURN_MS);
        return;
      }
      timeoutId = setTimeout(tick, STEP_MS);
    };

    timeoutId = setTimeout(tick, STEP_MS);
    return () => { cancelled = true; clearTimeout(timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const litHeight = (burnStep / BURN_STEPS) * TITLE_HEIGHT;
  const flameBottom = Math.max(0, litHeight - FLAME_SIZE * 0.35);

  return (
    <View style={styles.container}>
      <DotRow position="top" />

      <View style={styles.stack}>
        <Animated.View style={[styles.stackLayer, { opacity: titleOpacity }]}>
          <View style={styles.titleBox}>
            <Text style={styles.title}>TINT</Text>
            <View style={[styles.litClip, { height: litHeight }]}>
              <View style={styles.litInner}>
                <Text style={[styles.title, styles.titleLit]}>TINT</Text>
              </View>
            </View>
            {phase === 'burning' && (
              <View style={[styles.flameWrap, { bottom: flameBottom }]}>
                <MiniFlame frameIndex={flameFrame} size={FLAME_SIZE} />
              </View>
            )}
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
    flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 24,
  },
  dot: { width: 4, height: 4, backgroundColor: Colors.gray[700] },
  dotPop: { backgroundColor: Colors.popDeep },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  stack: { width: '100%', height: 140, alignItems: 'center', justifyContent: 'center' },
  stackLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: '100%' },

  titleBox: { height: TITLE_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  title: {
    fontFamily: Fonts.pixel, fontSize: TITLE_SIZE, color: Colors.gray[700],
    letterSpacing: 4, textTransform: 'uppercase',
  },
  titleLit: { color: Colors.textPrimary },

  litClip: {
    position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden',
  },
  litInner: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: TITLE_HEIGHT,
    alignItems: 'center', justifyContent: 'flex-end',
  },

  flameWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },

  tagline: {
    fontFamily: Fonts.pixel, fontSize: 20, color: Colors.gray[400],
    letterSpacing: 1, textTransform: 'uppercase',
  },
});
