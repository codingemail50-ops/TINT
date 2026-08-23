import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { PixelFlame } from './PixelFlame';
import { FLAME_PALETTES } from './flameShapes';

interface Props {
  /** Today's focus time / daily goal, as a 0..1+ ratio. */
  progress: number;
  /** Current streak length in days — shifts the flame's color tier. */
  streak: number;
  maxSize?: number;
}

// Streak-based color tiers, escalating with weekly-ish milestones — same
// palettes already built into flameShapes.ts.
function intensityForStreak(streak: number): keyof typeof FLAME_PALETTES {
  if (streak >= 14) return 'blazing';
  if (streak >= 7) return 'hot';
  if (streak >= 2) return 'pop';
  return 'warm';
}

// The home flame as a bonfire: starts small and dim over a pile of logs at
// the start of the day, and grows bigger/brighter as today's focus time
// climbs toward the daily goal — separate from the streak-driven color tier,
// so "how lit is it right now" and "how hot has the streak made it" read as
// two different signals. Size changes only between sessions (not something
// the user watches happen live), so it just re-renders at the new size;
// opacity is animated since that dimming/brightening is worth the polish.
export const Bonfire: React.FC<Props> = ({ progress, streak, maxSize = 150 }) => {
  const clamped = Math.max(0, Math.min(1, progress));
  const minSize = maxSize * 0.42;
  const size = minSize + (maxSize - minSize) * clamped;
  const targetOpacity = 0.5 + 0.5 * clamped;
  const intensity = intensityForStreak(streak);

  const opacityAnim = useRef(new Animated.Value(targetOpacity)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, { toValue: targetOpacity, duration: 500, useNativeDriver: true }).start();
  }, [targetOpacity]);

  const logsWidth = maxSize * 0.6;

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ opacity: opacityAnim, marginBottom: -6 }}>
        <PixelFlame size={size} state="flicker" intensity={intensity} />
      </Animated.View>
      <View style={[styles.logs, { width: logsWidth }]}>
        <View style={[styles.log, { width: logsWidth, transform: [{ rotate: '-3deg' }] }]} />
        <View style={[styles.log, { width: logsWidth * 0.85, marginTop: -6, transform: [{ rotate: '4deg' }] }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  logs: { alignItems: 'center' },
  log: { height: 10, borderRadius: 5, backgroundColor: '#6B4226', borderWidth: 1, borderColor: '#3A2415' },
});
