import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { buildBonfireStage, BONFIRE_STAGE_COUNT } from './pixelBonfireStages';
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

// Which of the 6 growth stages (ash -> kindling -> small flame -> ... ->
// biggest blazing flame) today's progress toward the daily goal has reached.
function stageForProgress(progress: number): number {
  if (progress <= 0) return 1;
  if (progress < 0.15) return 2;
  if (progress < 0.35) return 3;
  if (progress < 0.6) return 4;
  if (progress < 1) return 5;
  return BONFIRE_STAGE_COUNT;
}

// The home flame as a bonfire that visibly grows through distinct stages
// over the course of the day — unlit ash, kindling with smoke, then a
// flame that gets bigger and gains logs/licks as focus time climbs toward
// the goal. Color tier is a separate axis driven by the streak, so "how
// far into today" and "how hot has the streak made it" read as two
// different signals layered on the same sprite.
export const Bonfire: React.FC<Props> = ({ progress, streak, maxSize = 150 }) => {
  const clamped = Math.max(0, progress);
  const stage = stageForProgress(clamped);
  const intensity = intensityForStreak(streak);
  const lit = stage >= 3;

  const def = useMemo(() => buildBonfireStage(stage, intensity), [stage, intensity]);
  // Every stage shares one grid sized for the tallest (stage 6), so a small
  // early-stage sprite (ash pile, kindling) sits low in a mostly-empty
  // canvas — cropping to the stage's actual content keeps it snug against
  // whatever's above it instead of floating with dead space on top.
  const minY = useMemo(() => Math.min(...def.cells.map(c => c.y)), [def]);
  const cropRows = def.rows - minY;
  const height = (maxSize / def.cols) * cropRows;

  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!lit) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.03, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [lit, breathe]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale: lit ? breathe : 1 }] }}>
        <Svg width={maxSize} height={height} viewBox={`0 ${minY} ${def.cols} ${cropRows}`}>
          {def.cells.map((c, i) => (
            <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.color} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
