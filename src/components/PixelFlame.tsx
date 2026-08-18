import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { FLAME_FRAMES, FLAME_COLS, FLAME_ROWS, FLAME_PALETTES, FlamePalette } from './flameShapes';

const FLICKER_INTERVAL_MS = 160;

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

  useEffect(() => {
    if (state !== 'flicker') return;
    const id = setInterval(() => {
      setFrameIndex(i => (i + 1) % FLAME_FRAMES.length);
    }, FLICKER_INTERVAL_MS);
    return () => clearInterval(id);
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
    </Animated.View>
  );
};
