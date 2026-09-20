import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { buildBonfireStage } from './pixelBonfireStages';
import { Colors, Fonts } from '../constants/theme';

interface Props {
  /** Fires once, right when the intro sequence lands (flame blazing,
   *  wordmark settled) — NOT after some fixed total duration. The caller
   *  decides when to actually navigate away (see AppNavigator's boot
   *  screen); this component just holds on that final frame for as long
   *  as it stays mounted, so a slow network never exposes a blank gap
   *  behind a self-timed fade-out. */
  onFinish: () => void;
}

// Same 34x28 grid for every stage (buildBonfireStage never changes cols/rows,
// only which cells are lit) — sharing one fixed, uncropped viewBox across all
// three layers is what lets them sit stacked and cross-dissolve without the
// flame visibly resizing or shifting between stages.
const COLS = 34;
const ROWS = 28;
const SIZE = 220;

// Discrete stage jumps (ash -> catches -> full blaze), each held before the
// next, deliberately NOT tweened between shapes — a retro sprite-swap reads
// as "GBA startup screen," a smoothly-morphing flame reads as a modern
// animation with a pixel filter over it, which is exactly what this is
// meant to avoid.
const ASH = buildBonfireStage(1);
const CATCHES = buildBonfireStage(3, 'pop');
const BLAZE = buildBonfireStage(6, 'pop');

function StageLayer({ def, opacity }: { def: typeof ASH; opacity: Animated.Value }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { opacity, alignItems: 'center', justifyContent: 'center' }]}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${COLS} ${ROWS}`}>
        {def.cells.map((c, i) => (
          <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.color} />
        ))}
      </Svg>
    </Animated.View>
  );
}

// A brand-establishing boot sequence, not a loading spinner: unlit ash
// (grey) catches into a small flame, jumps to a full blaze (orange), then
// the wordmark lands — black -> grey -> orange, matching TINT's own
// bonfire-grows-with-focus mechanic instead of inventing separate splash
// art. Plays once (~1.7s), then holds on the final frame (blaze + wordmark,
// still gently breathing) until whoever mounted this unmounts it — see
// onFinish above for why it doesn't time its own exit.
export const SplashAnimation: React.FC<Props> = ({ onFinish }) => {
  const ashOpacity = useRef(new Animated.Value(0)).current;
  const catchesOpacity = useRef(new Animated.Value(0)).current;
  const blazeOpacity = useRef(new Animated.Value(0)).current;
  const wordScale = useRef(new Animated.Value(0.8)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      // Ignition: ash fades in, holds, then the flame catches.
      Animated.timing(ashOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(catchesOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(400),
      // Growth: jumps straight to the full blaze — a snap, not a grow-tween.
      Animated.timing(blazeOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      // Wordmark lands right after the blaze.
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(wordScale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onFinish();
    });

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.03, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.flameWrap, { transform: [{ scale: breathe }] }]}>
        <StageLayer def={ASH} opacity={ashOpacity} />
        <StageLayer def={CATCHES} opacity={catchesOpacity} />
        <StageLayer def={BLAZE} opacity={blazeOpacity} />
      </Animated.View>
      <Animated.Text style={[styles.wordmark, { opacity: wordOpacity, transform: [{ scale: wordScale }] }]}>
        TINT
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  flameWrap: { width: SIZE, height: SIZE },
  wordmark: {
    fontFamily: Fonts.pixel,
    fontSize: 56,
    letterSpacing: 4,
    color: Colors.textPrimary,
  },
});
