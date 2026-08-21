import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Colors, Fonts } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

interface Props {
  /** Overall touch-area size — also the component's rendered footprint. */
  size?: number;
  minValue: number;
  maxValue: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  unitLabel?: string;
}

// A rotary control styled like a hardware macro-pad/volume knob — knurled
// disc that spins freely under your finger (like a real encoder, no hard
// stop even past min/max), fixed pointer notch on the housing, and a
// haptic tick on every detent regardless of whether the clamped value
// actually moved.
export const KnurledDial: React.FC<Props> = ({
  size = 260, minValue, maxValue, step, value, onChange, formatValue, unitLabel,
}) => {
  const knobR = size * 0.385;
  const knobD = knobR * 2;
  const knobOffset = (size - knobD) / 2;
  const capR = knobR * 0.6;
  const knurlCount = 44;
  const knurlInner = knobR - size * 0.058;
  const knurlOuter = knobR - size * 0.0115;
  const degreesPerStep = 360 / knurlCount;

  const knurlLines = useRef(
    Array.from({ length: knurlCount }, (_, i) => {
      const angle = (360 / knurlCount) * i;
      const inner = polarToCartesian(knobR, knobR, knurlInner, angle);
      const outer = polarToCartesian(knobR, knobR, knurlOuter, angle);
      return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
    })
  ).current;

  const [turns, setTurns] = useState(0);
  const { dialTick } = useHaptics();

  const lastAngle = useSharedValue<number | null>(null);
  const accum = useSharedValue(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const turnsRef = useRef(0);

  // Marked as its own worklet, not just a plain closure — it's called from
  // inside the Gesture.Pan worklets below, and on native those run on the
  // UI thread; a function without its own 'worklet' directive isn't
  // guaranteed to be callable from there the way it is in the web polyfill
  // (where everything runs on one thread), which is a real crash risk.
  const angleOfTouch = (x: number, y: number): number => {
    'worklet';
    const dx = x - size / 2;
    const dy = y - size / 2;
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  };

  const bumpValue = (direction: 1 | -1) => {
    turnsRef.current += direction;
    setTurns(turnsRef.current);
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
        accum.value += delta;
        while (accum.value >= degreesPerStep) {
          accum.value -= degreesPerStep;
          runOnJS(bumpValue)(1);
        }
        while (accum.value <= -degreesPerStep) {
          accum.value += degreesPerStep;
          runOnJS(bumpValue)(-1);
        }
      }
      lastAngle.value = angle;
    })
    .onEnd(() => {
      'worklet';
      lastAngle.value = null;
    });

  const knobRotation = turns * degreesPerStep;
  const gradId = useRef(`knobFace${Math.random().toString(36).slice(2)}`).current;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: size, height: size }}>
        <View
          style={[styles.pointerNotch, { top: knobOffset - size * 0.035, left: size / 2 - size * 0.0115, width: size * 0.023, height: size * 0.06 }]}
          pointerEvents="none"
        />

        <View
          style={[styles.knob, { top: knobOffset, left: knobOffset, width: knobD, height: knobD, transform: [{ rotate: `${knobRotation}deg` }] }]}
          pointerEvents="none"
        >
          <Svg width={knobD} height={knobD}>
            <Defs>
              <RadialGradient id={gradId} cx="35%" cy="30%" r="75%">
                <Stop offset="0" stopColor={Colors.gray[600]} />
                <Stop offset="1" stopColor={Colors.gray[900]} />
              </RadialGradient>
            </Defs>
            <Circle cx={knobR} cy={knobR} r={knobR - 2} fill={`url(#${gradId})`} stroke={Colors.gray[950]} strokeWidth={2} />
            {knurlLines.map((l, i) => (
              <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={Colors.gray[950]} strokeWidth={2} strokeLinecap="round" />
            ))}
          </Svg>
        </View>

        <View style={styles.dialCenter} pointerEvents="none">
          <View style={[styles.cap, { width: capR * 2, height: capR * 2, borderRadius: capR }]}>
            <Text style={[styles.dialValue, { fontSize: size * 0.154 }]}>{formatValue ? formatValue(value) : String(value)}</Text>
            {!!unitLabel && <Text style={styles.dialLabel}>{unitLabel}</Text>}
          </View>
        </View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  knob: { position: 'absolute' },
  pointerNotch: { position: 'absolute', borderRadius: 3, backgroundColor: Colors.gray[300] },
  dialCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  cap: {
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.gray[950],
    alignItems: 'center', justifyContent: 'center',
  },
  dialValue: { fontFamily: Fonts.pixel, color: Colors.textPrimary, letterSpacing: 0 },
  dialLabel: { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: -4, textTransform: 'uppercase', letterSpacing: 1 },
});
