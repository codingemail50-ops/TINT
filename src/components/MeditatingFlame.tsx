import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { MEDITATING_FLAME } from './meditatingFlame';

interface Props {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// A calm mascot for the active Focus timer — sits still and breathes gently
// rather than flickering, to read as "meditating" instead of "burning".
export const MeditatingFlame: React.FC<Props> = ({ size = 80, style }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 1800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [scale]);

  const px = size / MEDITATING_FLAME.cols;
  const height = px * MEDITATING_FLAME.rows;

  return (
    <Animated.View style={[{ width: size, height, transform: [{ scale }] }, style]}>
      <Svg width={size} height={height} viewBox={`0 0 ${MEDITATING_FLAME.cols} ${MEDITATING_FLAME.rows}`}>
        {MEDITATING_FLAME.cells.map((c, i) => (
          <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.color} />
        ))}
      </Svg>
    </Animated.View>
  );
};
