import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';

const { width } = Dimensions.get('window');

const SPARKS = ['⭐', '✨', '🌟', '💫', '⚡', '🎉'];

interface Props {
  onDismiss: () => void;
}

export default function AllDoneCelebration({ onDismiss }: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const sparkAnims = useRef(
    SPARKS.map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    // Main card entrance
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 150, friction: 7 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Sparks burst
    const sparkAnimations = sparkAnims.map((anim, i) => {
      const angle = (i / SPARKS.length) * 2 * Math.PI;
      const distance = 100 + Math.random() * 60;
      return Animated.sequence([
        Animated.delay(i * 60),
        Animated.parallel([
          Animated.timing(anim.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(anim.scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 5 }),
          Animated.timing(anim.x, { toValue: Math.cos(angle) * distance, duration: 600, useNativeDriver: true }),
          Animated.timing(anim.y, { toValue: Math.sin(angle) * distance, duration: 600, useNativeDriver: true }),
        ]),
        Animated.timing(anim.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]);
    });

    Animated.stagger(40, sparkAnimations).start();
  }, []);

  return (
    <View style={s.overlay}>
      {/* Sparks */}
      {sparkAnims.map((anim, i) => (
        <Animated.Text
          key={i}
          style={[
            s.spark,
            {
              opacity: anim.opacity,
              transform: [
                { translateX: anim.x },
                { translateY: anim.y },
                { scale: anim.scale },
              ],
            },
          ]}
        >
          {SPARKS[i]}
        </Animated.Text>
      ))}

      {/* Card */}
      <Animated.View
        style={[
          s.card,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      >
        <Text style={s.trophy}>🏆</Text>
        <Text style={s.title}>All done!</Text>
        <Text style={s.sub}>You crushed today's tasks.{'\n'}Your streak is safe. 🔥</Text>
        <TouchableOpacity style={s.btn} onPress={onDismiss}>
          <Text style={s.btnText}>Keep going →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8,8,16,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  spark: { position: 'absolute', fontSize: 24 },
  card: {
    backgroundColor: '#13131F',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: width - 64,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  trophy: { fontSize: 64, marginBottom: 12 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn: { backgroundColor: '#6366F1', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
