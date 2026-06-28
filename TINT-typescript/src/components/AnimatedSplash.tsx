import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface Props {
  onDone: () => void;
}

export default function AnimatedSplash({ onDone }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const squishY = useRef(new Animated.Value(0.3)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Fade in + squish up
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(squishY, { toValue: 1.15, useNativeDriver: true, tension: 200, friction: 5 }),
        Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true, tension: 200, friction: 5 }),
      ]),
      // Settle back
      Animated.parallel([
        Animated.spring(squishY, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }),
      ]),
      // Show tagline
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      // Hold
      Animated.delay(600),
      // Fade out everything
      Animated.timing(fadeOut, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: fadeOut }]}>
      <Animated.View
        style={{
          transform: [
            { scaleX: scaleAnim },
            { scaleY: squishY },
          ],
          opacity: opacityAnim,
          alignItems: 'center',
        }}
      >
        <Text style={s.logo}>TINT</Text>
      </Animated.View>
      <Animated.Text style={[s.tagline, { opacity: taglineOpacity }]}>
        THERE IS NO TOMORROW
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    width,
    height,
    backgroundColor: '#080810',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logo: {
    fontSize: 72,
    fontWeight: '900',
    color: '#6366F1',
    letterSpacing: 8,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 4,
    marginTop: 16,
  },
});
