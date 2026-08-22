import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scallopPath } from '../utils/scallopPath';
import { Colors, Fonts } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';

interface Props {
  size?: number;
  minValue: number;
  maxValue: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  unitLabel?: string;
}

// Physical rotation needed per detent, and how much a raw finger-angle delta
// counts toward that — same tuning approach as KnurledDial (slower/heavier
// than a 1:1 mapping so small flicks don't jump several steps at once).
const DEGREES_PER_STEP = 9;
const ROTATION_SENSITIVITY = 0.45;

// The Focus timer's squiggly-circle shape, repurposed as a rotary drag
// control — grey, static (it doesn't spin visually), clockwise drag
// increases the value, with a haptic tick on every detent.
export const BlobDial: React.FC<Props> = ({
  size = 240, minValue, maxValue, step, value, onChange, formatValue, unitLabel,
}) => {
  const blobPath = useRef(scallopPath(size / 2, size / 2, size * 0.36, 15, size * 0.02).d).current;
  const valueRef = useRef(value);
  valueRef.current = value;
  const { dialTick } = useHaptics();

  const lastAngle = useSharedValue<number | null>(null);
  const accum = useSharedValue(0);

  const angleOfTouch = (x: number, y: number): number => {
    'worklet';
    const dx = x - size / 2;
    const dy = y - size / 2;
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  };

  const bumpValue = (direction: 1 | -1) => {
    const next = Math.min(maxValue, Math.max(minValue, valueRef.current + direction * step));
    if (next !== valueRef.current) {
      valueRef.current = next;
      onChange(next);
    }
    void dialTick();
  };

  const pan = Gesture.Pan()
    .onStart(e => {
      'worklet';
      lastAngle.value = angleOfTouch(e.x, e.y);
      accum.value = 0;
    })
    .onUpdate(e => {
      'worklet';
      const angle = angleOfTouch(e.x, e.y);
      if (lastAngle.value !== null) {
        let delta = angle - lastAngle.value;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        accum.value += delta * ROTATION_SENSITIVITY;
        while (accum.value >= DEGREES_PER_STEP) {
          accum.value -= DEGREES_PER_STEP;
          runOnJS(bumpValue)(1);
        }
        while (accum.value <= -DEGREES_PER_STEP) {
          accum.value += DEGREES_PER_STEP;
          runOnJS(bumpValue)(-1);
        }
      }
      lastAngle.value = angle;
    })
    .onEnd(() => {
      'worklet';
      lastAngle.value = null;
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFillObject}>
          <Path d={blobPath} fill={Colors.gray[800]} stroke={Colors.gray[600]} strokeWidth={2} />
        </Svg>
        <Text style={[styles.value, { fontSize: size * 0.16 }]}>{formatValue ? formatValue(value) : String(value)}</Text>
        {!!unitLabel && <Text style={styles.label}>{unitLabel}</Text>}
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  value: { fontFamily: Fonts.pixel, color: Colors.textPrimary, letterSpacing: 0 },
  label: { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: -4, textTransform: 'uppercase', letterSpacing: 1 },
});
