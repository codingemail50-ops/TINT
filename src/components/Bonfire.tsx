import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { buildBonfireStage, BONFIRE_STAGE_COUNT } from './pixelBonfireStages';
import { FLAME_PALETTES } from './flameShapes';

interface Props {
  /** Today's focus minutes so far (absolute, not a percentage of any
   *  goal) — the flame's stage is a flat "every 30 minutes" ladder now,
   *  decoupled from the daily goal entirely. */
  todayMins: number;
  /** The highest single-day focus total ever reached (see
   *  loadBestFlameMins/saveBestFlameMins in focusLog.ts) — the displayed
   *  stage is never lower than whatever this maps to, so a new day starts
   *  wherever the best day left off instead of resetting to the bottom.
   *  Defaults to 0 for callers with no real history (e.g. the walkthrough's
   *  illustrative mock). */
  bestMins?: number;
  /** Current streak length in days — shifts the flame's color tier. */
  streak: number;
  /** Total vertical budget. The biggest stage (6, blazing) fills it
   *  exactly; every other stage renders proportionally shorter at the
   *  same px-per-grid-unit scale, so the flame's base always sits at the
   *  bottom of this box while its tip varies — a fixed ground line, not a
   *  fixed bounding box. */
  maxHeight?: number;
}

// Streak-based color tiers, escalating with weekly-ish milestones — same
// palettes already built into flameShapes.ts.
function intensityForStreak(streak: number): keyof typeof FLAME_PALETTES {
  if (streak >= 14) return 'blazing';
  if (streak >= 7) return 'hot';
  if (streak >= 2) return 'pop';
  return 'warm';
}

// The lowest stage anyone ever sees now — stages 1-2 (unlit ash, then
// kindling with no actual flame yet) used to show up at the start of every
// single day, which read as "the app thinks I've done nothing" rather than
// motivating. Stage 3, the first stage with a real (if small) flame, is now
// the permanent floor.
const FLOOR_STAGE = 3;
const MINS_PER_STAGE = 30;

// Flat "every 30 minutes bumps a stage" ladder starting from the floor —
// replaces the old percent-of-daily-goal curve entirely, since the goal
// varies per person and per day while a flat minutes ladder doesn't.
function stageForMinutes(mins: number): number {
  if (mins <= 0) return FLOOR_STAGE;
  return Math.min(BONFIRE_STAGE_COUNT, FLOOR_STAGE + Math.floor(mins / MINS_PER_STAGE));
}

function cropRowsOf(def: ReturnType<typeof buildBonfireStage>): number {
  const minY = Math.min(...def.cells.map(c => c.y));
  return def.rows - minY;
}

// The tallest stage's content height, in grid units — the reference the
// px-per-unit scale is derived from. Shape doesn't depend on intensity, so
// this is computed once at module load, not per render.
const TALLEST_CROP_ROWS = cropRowsOf(buildBonfireStage(BONFIRE_STAGE_COUNT));

// The home flame as a bonfire that visibly grows through distinct stages
// as focus minutes add up — always at least a small real flame (see
// FLOOR_STAGE), gaining size and logs/licks every 30 minutes, and never
// dropping below the best day it's ever reached. Color tier is a separate
// axis driven by the streak, so "how much I've focused" and "how hot has
// the streak made it" read as two different signals layered on the same
// sprite.
export const Bonfire: React.FC<Props> = ({ todayMins, bestMins = 0, streak, maxHeight = 190 }) => {
  const stage = Math.max(stageForMinutes(todayMins), stageForMinutes(bestMins));
  const intensity = intensityForStreak(streak);

  const def = useMemo(() => buildBonfireStage(stage, intensity), [stage, intensity]);
  const minY = useMemo(() => Math.min(...def.cells.map(c => c.y)), [def]);
  const cropRows = def.rows - minY;

  const scale = maxHeight / TALLEST_CROP_ROWS;
  const renderedHeight = scale * cropRows;
  const renderedWidth = scale * def.cols;

  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.03, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  return (
    <View style={[styles.wrap, { height: maxHeight }]}>
      <Animated.View style={{ transform: [{ scale: breathe }] }}>
        <Svg width={renderedWidth} height={renderedHeight} viewBox={`0 ${minY} ${def.cols} ${cropRows}`}>
          {def.cells.map((c, i) => (
            <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.color} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
});
