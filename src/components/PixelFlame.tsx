import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { FLAME_FRAMES, FLAME_COLS, FLAME_ROWS, FLAME_PALETTES, FlamePalette } from './flameShapes';

const FLICKER_INTERVAL_MS = 160;
const FLICKER_JITTER_MS = 90; // +/- randomness so the swap timing doesn't feel mechanical
const SPARK_COUNT = 3;

interface PixelFlameProps {
  /** Rendered width in px — height follows the grid's aspect ratio. */
  size?: number;
  /** 'static' = single frame, no animation (tiny badges/icons).
   *  'resting' = dimmed, slow breathing loop (idle state).
   *  'flicker' = cycles through frames continuously (hero flame). */
  state?: 'static' | 'resting' | 'flicker';
  /** Color stage — swap this as focus-time progress increases. */
  intensity?: keyof typeof FLAME_PALETTES;
  style?: StyleProp<ViewStyle>;
}

export const PixelFlame: React.FC<PixelFlameProps> = ({
  size = 52, state = 'static', intensity = 'warm', style,
}) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const scale = useRef(new Animated.Value(state === 'resting' ? 0.95 : 1)).current;
  const opacity = useRef(new Animated.Value(state === 'resting' ? 0.5 : 1)).current;
  const sparks = useRef(
    Array.from({ length: SPARK_COUNT }, () => ({
      y: new Animated.Value(0),
      x: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (state !== 'flicker') return;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      setFrameIndex(i => (i + 1) % FLAME_FRAMES.length);
      const jitter = FLICKER_INTERVAL_MS + (Math.random() - 0.5) * FLICKER_JITTER_MS;
      id = setTimeout(tick, jitter);
    };
    id = setTimeout(tick, FLICKER_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [state]);

  useEffect(() => {
    if (state !== 'resting') return;
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.03, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.95, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [state, scale]);

  // Small embers drifting up off the tip and fading out — each spark loops
  // on its own randomized delay/duration so they don't launch in sync.
  useEffect(() => {
    if (state !== 'flicker') return;
    let cancelled = false;
    sparks.forEach((spark, i) => {
      const loop = () => {
        if (cancelled) return;
        spark.y.setValue(0);
        spark.x.setValue(0);
        spark.opacity.setValue(0);
        const drift = (Math.random() - 0.5) * size * 0.25;
        const duration = 1200 + Math.random() * 900;
        Animated.sequence([
          Animated.delay(i * 550 + Math.random() * 400),
          Animated.parallel([
            Animated.timing(spark.opacity, { toValue: 0.9, duration: 200, useNativeDriver: true }),
            Animated.timing(spark.y, { toValue: -size * 0.55, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(spark.x, { toValue: drift, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.timing(spark.opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) loop(); });
      };
      loop();
    });
    return () => { cancelled = true; };
  }, [state, size]);

  const frame = FLAME_FRAMES[state === 'flicker' ? frameIndex : 0];
  const palette: FlamePalette = FLAME_PALETTES[intensity];
  const px = size / FLAME_COLS;
  const height = px * FLAME_ROWS;

  return (
    <Animated.View style={[{ width: size, height, opacity, transform: [{ scale }] }, style]}>
      <Svg width={size} height={height} viewBox={`0 0 ${FLAME_COLS} ${FLAME_ROWS}`}>
        {frame.outline.map((c, i) => (
          <Rect key={`o${i}`} x={c.x} y={c.y} width={1} height={1} fill={palette.outline} />
        ))}
        {frame.cells.map((c, i) => (
          <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={palette.shades[c.shade - 1]} />
        ))}
      </Svg>
      {state === 'flicker' && sparks.map((spark, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: height * 0.1,
            left: size / 2 - 1.5,
            width: 3, height: 3, borderRadius: 1.5,
            backgroundColor: palette.shades[3],
            opacity: spark.opacity,
            transform: [{ translateY: spark.y }, { translateX: spark.x }],
          }}
        />
      ))}
    </Animated.View>
  );
};
