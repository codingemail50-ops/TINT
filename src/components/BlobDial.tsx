import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
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

// A static curved arrow near the top of the dial, hinting which way to drag
// to increase the value — the spinning blob alone gives no visual cue for
// that, and testing found people don't intuit it's a rotary control at all.
const HINT_START_DEG = -34;
const HINT_END_DEG = 34;

function pointOnCircle(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

// The Focus timer's squiggly-circle shape, repurposed as a rotary drag
// control — the whole shape spins under your finger 1:1 with the real
// angle dragged (an orange dot marks the current position on the rim so
// the spin is easy to track), while an internal, more heavily-damped
// accumulator decides when that motion has covered enough ground to
// actually bump the value by one step and fire a haptic tick.
export const BlobDial: React.FC<Props> = ({
  size = 240, minValue, maxValue, step, value, onChange, formatValue, unitLabel,
}) => {
  const blobPath = useRef(scallopPath(size / 2, size / 2, size * 0.36, 15, size * 0.02).d).current;
  // Matches the scallop's peak radius (rBase + amp) at its topmost point,
  // so the dot sits right on the rim rather than floating inside/outside it.
  const dotRadius = size * 0.36 + size * 0.02;
  const valueRef = useRef(value);
  valueRef.current = value;
  const { dialTick } = useHaptics();

  const lastAngle = useSharedValue<number | null>(null);
  const accum = useSharedValue(0);
  const rotation = useSharedValue(0);
  // Mirrors `value` on the UI thread so the worklet below can tell it's
  // already at the cap — without this, dragging past min/max kept spinning
  // the dot with your finger even though the number had stopped changing,
  // leaving the dot's position meaning nothing once you reversed direction.
  const currentValueSV = useSharedValue(value);
  useEffect(() => { currentValueSV.value = value; }, [value, currentValueSV]);

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
        const atMax = currentValueSV.value >= maxValue;
        const atMin = currentValueSV.value <= minValue;
        if (!((atMax && delta > 0) || (atMin && delta < 0))) {
          rotation.value += delta;
        }
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

  const rotatingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Fixed (non-rotating) hint arc + arrowhead, just outside the blob's rim.
  const center = size / 2;
  const hintRadius = dotRadius + size * 0.05;
  const hintStart = pointOnCircle(center, center, hintRadius, HINT_START_DEG);
  const hintEnd = pointOnCircle(center, center, hintRadius, HINT_END_DEG);
  const hintArcPath = `M ${hintStart.x} ${hintStart.y} A ${hintRadius} ${hintRadius} 0 0 1 ${hintEnd.x} ${hintEnd.y}`;
  const arrowSize = size * 0.028;
  const arrowTangentDeg = HINT_END_DEG + 90;
  const arrowPath = `M ${-arrowSize} ${-arrowSize * 0.65} L ${arrowSize} 0 L ${-arrowSize} ${arrowSize * 0.65} Z`;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFillObject, rotatingStyle]}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Path d={blobPath} fill={Colors.gray[800]} stroke={Colors.gray[600]} strokeWidth={2} />
            <Circle cx={size / 2} cy={size / 2 - dotRadius} r={size * 0.035} fill={Colors.pop} />
          </Svg>
        </Animated.View>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Path d={hintArcPath} stroke={Colors.textSecondary} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} />
          <Path d={arrowPath} fill={Colors.textSecondary} opacity={0.6} transform={`translate(${hintEnd.x}, ${hintEnd.y}) rotate(${arrowTangentDeg})`} />
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
