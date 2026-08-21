import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';

const DIAL_SIZE = 260;
const RING_R = 108;
const RING_STROKE = 16;
const START_ANGLE = -135;
const SWEEP = 270;
const MIN_MINS = 15;
const MAX_MINS = 180;
const STEP_MINS = 5;
const DEFAULT_MINS = 60;
// Degrees of finger rotation needed to advance one step — tuned so a
// full drag around the dial covers the whole range without feeling twitchy.
const DEGREES_PER_STEP = 8;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}
// Angle of a touch point relative to the dial's center, using the same
// "0 = up, clockwise positive" convention as polarToCartesian above.
function angleOfTouch(x: number, y: number): number {
  const dx = x - DIAL_SIZE / 2;
  const dy = y - DIAL_SIZE / 2;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

function formatGoal(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface Props {
  initialMins?: number;
  onComplete: (dailyFocusGoalMins: number) => void;
  onBack?: () => void;
}

// Screen 2 of onboarding (also reused from the Profile screen to change the
// goal later) — a rotary dial: drag clockwise to raise the daily focus
// goal, counter-clockwise to lower it, with a haptic tick per 5-minute step.
export const FocusGoalScreen: React.FC<Props> = ({ initialMins = DEFAULT_MINS, onComplete, onBack }) => {
  const [mins, setMins] = useState(initialMins);
  const { dialTick, buttonPress } = useHaptics();

  // Shared values, not plain refs — these get mutated from inside UI-thread
  // worklets on every pan update, and a plain useRef's .current mutation
  // inside a worklet doesn't reliably persist back across calls the way a
  // Reanimated shared value does.
  const lastAngle = useSharedValue<number | null>(null);
  const accum = useSharedValue(0);
  const minsRef = useRef(mins);
  minsRef.current = mins;

  const bumpValue = (direction: 1 | -1) => {
    const next = Math.min(MAX_MINS, Math.max(MIN_MINS, minsRef.current + direction * STEP_MINS));
    if (next !== minsRef.current) {
      minsRef.current = next;
      setMins(next);
      void dialTick();
    }
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

  const progress = (mins - MIN_MINS) / (MAX_MINS - MIN_MINS);
  const knobAngle = START_ANGLE + progress * SWEEP;
  const knob = polarToCartesian(DIAL_SIZE / 2, DIAL_SIZE / 2, RING_R, knobAngle);

  const handleContinue = () => {
    buttonPress();
    onComplete(mins);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}
      <View style={styles.header}>
        <Text style={styles.stepNum}>02</Text>
        <Text style={styles.title}>Set your daily focus goal</Text>
        <Text style={styles.sub}>Turn the dial — you can always change this later.</Text>
      </View>

      <View style={styles.dialWrap}>
        <GestureDetector gesture={pan}>
          <View style={{ width: DIAL_SIZE, height: DIAL_SIZE }}>
            <Svg width={DIAL_SIZE} height={DIAL_SIZE}>
              <Path
                d={arcPath(DIAL_SIZE / 2, DIAL_SIZE / 2, RING_R, START_ANGLE, START_ANGLE + SWEEP)}
                stroke={Colors.surfaceElevated}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={arcPath(DIAL_SIZE / 2, DIAL_SIZE / 2, RING_R, START_ANGLE, Math.max(knobAngle, START_ANGLE + 0.01))}
                stroke={Colors.primary}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
              />
              <Circle cx={knob.x} cy={knob.y} r={RING_STROKE / 2 + 4} fill={Colors.textPrimary} />
            </Svg>
            <View style={styles.dialCenter} pointerEvents="none">
              <Text style={styles.dialValue}>{formatGoal(mins)}</Text>
              <Text style={styles.dialLabel}>per day</Text>
            </View>
          </View>
        </GestureDetector>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleContinue} activeOpacity={0.85}>
          <View style={styles.nextGradient}>
            <Text style={styles.nextText}>Continue →</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backBtn: { position: 'absolute', top: 58, left: Spacing.xl, zIndex: 1 },
  backText: { fontSize: 15, color: Colors.textSecondary, fontFamily: Fonts.medium },
  header: { paddingTop: 100, paddingHorizontal: Spacing.xl },
  stepNum: { fontSize: 56, fontFamily: Fonts.bold, color: Colors.primary + '18', letterSpacing: -3, marginBottom: -Spacing.lg, lineHeight: 64 },
  title: { fontSize: 26, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, fontFamily: Fonts.regular },
  dialWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dialCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  dialValue: { fontFamily: Fonts.pixel, fontSize: 46, color: Colors.textPrimary, letterSpacing: 0 },
  dialLabel: { fontSize: 13, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: -4, textTransform: 'uppercase', letterSpacing: 1 },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, paddingTop: Spacing.sm },
  nextBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  nextGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  nextText: { fontSize: 17, fontFamily: Fonts.bold, color: '#000', letterSpacing: 0.2 },
});
