import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props { streak: number; consistency: number; size?: number }

function getFlameColor(consistency: number): { inner: string; outer: string; glow: string } {
  if (consistency <= 0)  return { inner: '#555', outer: '#444', glow: '#33333300' };
  if (consistency < 25)  return { inner: '#FFE033', outer: '#FFB800', glow: '#FFD70066' };
  if (consistency < 50)  return { inner: '#FF9500', outer: '#FF6B00', glow: '#FF8C0066' };
  if (consistency < 75)  return { inner: '#FF4500', outer: '#CC2200', glow: '#FF450066' };
  if (consistency < 90)  return { inner: '#FF2200', outer: '#AA0000', glow: '#FF000066' };
  return                        { inner: '#00CFFF', outer: '#0080FF', glow: '#00BFFF88' }; // blue = hottest
}

export const FlameIcon: React.FC<Props> = ({ streak, consistency, size = 52 }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  const colors = getFlameColor(consistency);

  useEffect(() => {
    if (consistency <= 0) return;

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
  const iconSize = size * 0.5;

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
        <Ionicons
          name={consistency <= 0 ? 'flame-outline' : 'flame'}
          size={iconSize}
          color={colors.inner}
        />
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
  streakNum: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 3,
  },
});
