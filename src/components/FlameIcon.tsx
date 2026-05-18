import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface Props { streak: number; consistency: number; size?: number }

function getFlameColor(consistency: number): { inner: string; outer: string; glow: string } {
  if (consistency <= 0)  return { inner: '#555', outer: '#444', glow: '#33333300' };
  if (consistency < 25)  return { inner: '#FFE033', outer: '#FFB800', glow: '#FFD70066' };
  if (consistency < 50)  return { inner: '#FF9500', outer: '#FF6B00', glow: '#FF8C0066' };
  if (consistency < 75)  return { inner: '#FF4500', outer: '#CC2200', glow: '#FF450066' };
  if (consistency < 90)  return { inner: '#FF2200', outer: '#AA0000', glow: '#FF000066' };
  return                        { inner: '#00CFFF', outer: '#0080FF', glow: '#00BFFF88' }; // blue = hottest
}

function getFlameEmoji(consistency: number): string[] {
  if (consistency <= 0)  return ['🌑'];
  if (consistency < 25)  return ['🔥'];
  if (consistency < 50)  return ['🔥', '🔥'];
  if (consistency < 75)  return ['🔥', '🔥', '🔥'];
  if (consistency < 90)  return ['🔥', '🔥', '🔥', '🔥'];
  return                        ['💙', '🔥', '💙']; // blue flame
}

export const FlameIcon: React.FC<Props> = ({ streak, consistency, size = 52 }) => {
  const flicker1 = useRef(new Animated.Value(1)).current;
  const flicker2 = useRef(new Animated.Value(0.7)).current;
  const flicker3 = useRef(new Animated.Value(0.4)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  const colors = getFlameColor(consistency);
  const emojis = getFlameEmoji(consistency);

  useEffect(() => {
    if (consistency <= 0) return;

    // Flicker layers with different random-feeling timings
    Animated.loop(Animated.sequence([
      Animated.timing(flicker1, { toValue: 0.75, duration: 180, useNativeDriver: true }),
      Animated.timing(flicker1, { toValue: 1,    duration: 220, useNativeDriver: true }),
      Animated.timing(flicker1, { toValue: 0.85, duration: 150, useNativeDriver: true }),
      Animated.timing(flicker1, { toValue: 1,    duration: 190, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(flicker2, { toValue: 1,   duration: 200, useNativeDriver: true }),
      Animated.timing(flicker2, { toValue: 0.5, duration: 170, useNativeDriver: true }),
      Animated.timing(flicker2, { toValue: 0.8, duration: 210, useNativeDriver: true }),
      Animated.timing(flicker2, { toValue: 0.6, duration: 160, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(flicker3, { toValue: 0.9, duration: 250, useNativeDriver: true }),
      Animated.timing(flicker3, { toValue: 0.3, duration: 200, useNativeDriver: true }),
      Animated.timing(flicker3, { toValue: 0.7, duration: 180, useNativeDriver: true }),
    ])).start();

    // Slow scale breathe
    Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 700, useNativeDriver: true }),
    ])).start();

    // Glow pulse
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ])).start();
  }, [consistency]);

  const containerSize = size;
  const emojiSize = size * 0.46;

  return (
    <View style={[styles.wrapper, { width: containerSize, height: containerSize + 14 }]}>
      {/* Outer glow */}
      <Animated.View style={[styles.glow, {
        width:           containerSize + 14,
        height:          containerSize + 14,
        borderRadius:    (containerSize + 14) / 2,
        backgroundColor: colors.glow,
        opacity:         glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
        transform:       [{ scale: scaleAnim }],
      }]} />

      {/* Flame body */}
      <Animated.View style={[styles.flameBody, {
        width:        containerSize,
        height:       containerSize,
        borderRadius: containerSize / 2,
        transform:    [{ scale: scaleAnim }],
        borderColor:  colors.outer,
        shadowColor:  colors.glow,
      }]}>
        {/* Layer 1 — base */}
        <Animated.Text style={[styles.layer, { fontSize: emojiSize, opacity: flicker1 }]}>
          {emojis[0]}
        </Animated.Text>
        {/* Layer 2 — mid flicker */}
        {emojis.length > 1 && (
          <Animated.Text style={[styles.layer, styles.layerAbs, { fontSize: emojiSize * 0.75, opacity: flicker2, bottom: 2, left: -2 }]}>
            {emojis[1]}
          </Animated.Text>
        )}
        {/* Layer 3 — top flicker */}
        {emojis.length > 2 && (
          <Animated.Text style={[styles.layer, styles.layerAbs, { fontSize: emojiSize * 0.6, opacity: flicker3, top: 0, right: -2 }]}>
            {emojis[2]}
          </Animated.Text>
        )}
      </Animated.View>

      {/* Streak number below */}
      <Text style={[styles.streakNum, { color: colors.inner }]}>
        {streak}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  glow: {
    position: 'absolute',
    top: -7,
  },
  flameBody: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111120',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  layer: {
    textAlign: 'center',
  },
  layerAbs: {
    position: 'absolute',
  },
  streakNum: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 3,
  },
});
