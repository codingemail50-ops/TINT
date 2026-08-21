import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';

const DIAL_SIZE = 260;
const KNOB_R = 100;
const KNOB_D = KNOB_R * 2;
const KNOB_OFFSET = (DIAL_SIZE - KNOB_D) / 2;
const CAP_R = KNOB_R * 0.6;
const KNURL_COUNT = 44;
const KNURL_INNER = KNOB_R - 15;
const KNURL_OUTER = KNOB_R - 3;

const MIN_MINS = 15;
const MAX_MINS = 180;
const STEP_MINS = 5;
const DEFAULT_MINS = 60;
// Degrees of finger rotation needed to advance one step — tuned so a full
// drag around the dial covers the whole range without feeling twitchy, and
// so each step lands roughly on a knurl tooth for a "detented" feel.
const DEGREES_PER_STEP = 360 / KNURL_COUNT;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
// Angle of a touch point relative to the dial's center, using the same
// "0 = up, clockwise positive" convention as polarToCartesian above.
function angleOfTouch(x: number, y: number): number {
  const dx = x - DIAL_SIZE / 2;
  const dy = y - DIAL_SIZE / 2;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

// The ridged/knurled edge, like a hardware volume or macro-pad knob —
// computed once, not per render, since it never changes shape (only the
// disc it's drawn on rotates).
const KNURL_LINES = Array.from({ length: KNURL_COUNT }, (_, i) => {
  const angle = (360 / KNURL_COUNT) * i;
  const inner = polarToCartesian(KNOB_R, KNOB_R, KNURL_INNER, angle);
  const outer = polarToCartesian(KNOB_R, KNOB_R, KNURL_OUTER, angle);
  return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
});

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
// goal later) — a rotary dial styled like a hardware macro-pad/volume knob:
// a knurled disc that actually turns under your finger, with a fixed
// pointer notch on the housing and a haptic tick on every detent.
export const FocusGoalScreen: React.FC<Props> = ({ initialMins = DEFAULT_MINS, onComplete, onBack }) => {
  const [mins, setMins] = useState(initialMins);
  const [turns, setTurns] = useState(0); // unbounded rotation count, for the knob's visual spin
  const { dialTick, buttonPress } = useHaptics();

  // Shared values, not plain refs — these get mutated from inside UI-thread
  // worklets on every pan update, and a plain useRef's .current mutation
  // inside a worklet doesn't reliably persist back across calls the way a
  // Reanimated shared value does.
  const lastAngle = useSharedValue<number | null>(null);
  const accum = useSharedValue(0);
  const minsRef = useRef(mins);
  minsRef.current = mins;
  const turnsRef = useRef(0);

  const bumpValue = (direction: 1 | -1) => {
    // The knob itself spins freely (like a real encoder) even after the
    // value clamps at MIN/MAX, so it never feels like it's hit a wall.
    turnsRef.current += direction;
    setTurns(turnsRef.current);
    const next = Math.min(MAX_MINS, Math.max(MIN_MINS, minsRef.current + direction * STEP_MINS));
    if (next !== minsRef.current) {
      minsRef.current = next;
      setMins(next);
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

  const knobRotation = turns * DEGREES_PER_STEP;

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
            {/* Fixed pointer notch on the "housing" — stays put while the knob spins under it */}
            <View style={styles.pointerNotch} pointerEvents="none" />

            <View
              style={[
                styles.knob,
                { top: KNOB_OFFSET, left: KNOB_OFFSET, transform: [{ rotate: `${knobRotation}deg` }] },
              ]}
              pointerEvents="none"
            >
              <Svg width={KNOB_D} height={KNOB_D}>
                <Defs>
                  <RadialGradient id="knobFace" cx="35%" cy="30%" r="75%">
                    <Stop offset="0" stopColor={Colors.gray[600]} />
                    <Stop offset="1" stopColor={Colors.gray[900]} />
                  </RadialGradient>
                </Defs>
                <Circle cx={KNOB_R} cy={KNOB_R} r={KNOB_R - 2} fill="url(#knobFace)" stroke={Colors.gray[950]} strokeWidth={2} />
                {KNURL_LINES.map((l, i) => (
                  <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={Colors.gray[950]} strokeWidth={2} strokeLinecap="round" />
                ))}
              </Svg>
            </View>

            {/* Static cap + readout, layered on top — doesn't spin with the knob */}
            <View style={styles.dialCenter} pointerEvents="none">
              <View style={styles.cap}>
                <Text style={styles.dialValue}>{formatGoal(mins)}</Text>
                <Text style={styles.dialLabel}>per day</Text>
              </View>
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
  knob: { position: 'absolute', width: KNOB_D, height: KNOB_D },
  pointerNotch: {
    position: 'absolute', top: KNOB_OFFSET - 9, left: DIAL_SIZE / 2 - 3, width: 6, height: 16,
    borderRadius: 3, backgroundColor: Colors.gray[300],
  },
  dialCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  cap: {
    width: CAP_R * 2, height: CAP_R * 2, borderRadius: CAP_R,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.gray[950],
    alignItems: 'center', justifyContent: 'center',
  },
  dialValue: { fontFamily: Fonts.pixel, fontSize: 40, color: Colors.textPrimary, letterSpacing: 0 },
  dialLabel: { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: -4, textTransform: 'uppercase', letterSpacing: 1 },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, paddingTop: Spacing.sm },
  nextBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  nextGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  nextText: { fontSize: 17, fontFamily: Fonts.bold, color: '#000', letterSpacing: 0.2 },
});
