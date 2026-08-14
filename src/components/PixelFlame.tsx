import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

// Hand-authored pixel-art flame — 13 cols x 18 rows, each char maps to a shade.
const GRID = [
  '......2......',
  '.....22...3..',
  '.....22......',
  '....222......',
  '....2333.....',
  '...23334.....',
  '...233344....',
  '..2333444....',
  '..23334444...',
  '.233344444...',
  '.2333444442..',
  '23334444422..',
  '2333444442222',
  '233344444222.',
  '.2234444222..',
  '..224442222..',
  '..2244.2222..',
  '...244...22..',
];
const COLORS: Record<string, string> = {
  '1': '#7C1D0F',
  '2': '#C8280F',
  '3': '#F97316',
  '4': '#FFD23F',
};
const COLS = GRID[0].length;
const ROWS = GRID.length;

const RECTS = GRID.flatMap((row, ry) =>
  row.split('').map((ch, cx) => (COLORS[ch] ? { x: cx, y: ry, fill: COLORS[ch] } : null))
).filter((r): r is { x: number; y: number; fill: string } => r !== null);

interface PixelFlameProps {
  /** Rendered width in px — height follows the grid's aspect ratio. */
  size?: number;
  /** 'static' = full brightness, no animation (badges/icons).
   *  'resting' = dimmed, slow breathing loop (idle state). */
  state?: 'static' | 'resting';
  style?: StyleProp<ViewStyle>;
}

export const PixelFlame: React.FC<PixelFlameProps> = ({ size = 52, state = 'static', style }) => {
  const scale = useRef(new Animated.Value(state === 'resting' ? 0.95 : 1)).current;
  const opacity = useRef(new Animated.Value(state === 'resting' ? 0.5 : 1)).current;

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

  const px = size / COLS;
  const height = px * ROWS;

  return (
    <Animated.View style={[{ width: size, height, opacity, transform: [{ scale }] }, style]}>
      <Svg width={size} height={height} viewBox={`0 0 ${COLS} ${ROWS}`}>
        {RECTS.map((r, i) => (
          <Rect key={i} x={r.x} y={r.y} width={1} height={1} fill={r.fill} />
        ))}
      </Svg>
    </Animated.View>
  );
};
