import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography } from '../constants/theme';

interface Props {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
}

function getFlameEmoji(streak: number): string {
  if (streak === 0) return '🌑';
  if (streak < 3) return '🔥';
  if (streak < 7) return '🔥';
  if (streak < 14) return '🔥';
  if (streak < 30) return '🔥';
  return '🔥';
}

function getFlameColor(streak: number): string {
  if (streak === 0) return Colors.streakColors.cold;
  if (streak < 3) return Colors.streakColors.warm;
  if (streak < 7) return Colors.streakColors.hot;
  return Colors.streakColors.blazing;
}

function getFlameScale(streak: number): number {
  if (streak === 0) return 0.8;
  if (streak < 3) return 1.0;
  if (streak < 7) return 1.15;
  if (streak < 14) return 1.25;
  return 1.4;
}

export const StreakFlame: React.FC<Props> = ({ streak, size = 'md' }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (streak > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [streak]);

  const flameColor = getFlameColor(streak);
  const baseScale = getFlameScale(streak);

  const sizes = {
    sm: { container: 48, fontSize: 22, labelSize: 11 },
    md: { container: 72, fontSize: 32, labelSize: 13 },
    lg: { container: 96, fontSize: 44, labelSize: 16 },
  };

  const s = sizes[size];

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.glowRing,
          {
            width: s.container + 20,
            height: s.container + 20,
            borderRadius: (s.container + 20) / 2,
            backgroundColor: flameColor,
            opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, streak > 0 ? 0.3 : 0] }),
          },
        ]}
      />
      <Animated.View style={[styles.container, { width: s.container, height: s.container, borderRadius: s.container / 2, transform: [{ scale: Animated.multiply(pulseAnim, baseScale) }], borderColor: flameColor, shadowColor: flameColor }]}>
        <Text style={{ fontSize: s.fontSize }}>
          {streak === 0 ? '💤' : streak < 3 ? '🌤️' : streak < 7 ? '🔥' : streak < 14 ? '🔥' : '🔥'}
        </Text>
      </Animated.View>
      <View style={styles.label}>
        <Text style={[styles.streakNumber, { color: flameColor, fontSize: s.labelSize + 6 }]}>{streak}</Text>
        <Text style={[styles.streakText, { fontSize: s.labelSize, color: Colors.textSecondary }]}>day streak</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 8,
  },
  glowRing: {
    position: 'absolute',
    top: -10,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
    backgroundColor: Colors.surfaceElevated,
    zIndex: 1,
  },
  label: {
    alignItems: 'center',
  },
  streakNumber: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  streakText: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
