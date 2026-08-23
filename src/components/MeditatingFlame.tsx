import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { buildMeditatingFlame } from './pixelMascot';
import { FLAME_PALETTES } from './flameShapes';

interface Props {
  size?: number;
  intensity?: keyof typeof FLAME_PALETTES;
  style?: StyleProp<ViewStyle>;
}

// The brand mascot — calm, closed-eyed, meditating. Just a slow breathing
// scale loop, nothing more (a face/pose that reads clearly at rest was the
// point after the earlier busier attempts got pulled).
export const MeditatingFlame: React.FC<Props> = ({ size = 120, intensity = 'pop', style }) => {
  const def = useMemo(() => buildMeditatingFlame(intensity), [intensity]);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [scale]);

  const height = (size / def.cols) * def.rows;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Svg width={size} height={height} viewBox={`0 0 ${def.cols} ${def.rows}`}>
        {def.cells.map((c, i) => (
          <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.color} />
        ))}
      </Svg>
    </Animated.View>
  );
};
