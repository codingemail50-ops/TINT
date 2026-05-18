import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF922B','#CC5DE8','#F06595','#74C0FC','#A9E34B','#FF8787'];
const COUNT  = 70;

interface Particle { x: Animated.Value; y: Animated.Value; rot: Animated.Value; op: Animated.Value; color: string; size: number; isCircle: boolean }

interface Props { visible: boolean; onComplete?: () => void }

export const Confetti: React.FC<Props> = ({ visible, onComplete }) => {
  const particles = useRef<Particle[]>(
    [...Array(COUNT)].map((_, i) => ({
      x:       new Animated.Value(Math.random() * W),
      y:       new Animated.Value(-20 - Math.random() * 200),
      rot:     new Animated.Value(0),
      op:      new Animated.Value(1),
      color:   COLORS[i % COLORS.length],
      size:    6 + Math.random() * 8,
      isCircle: Math.random() > 0.5,
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    particles.forEach(p => {
      p.x.setValue(Math.random() * W);
      p.y.setValue(-20 - Math.random() * 300);
      p.rot.setValue(0);
      p.op.setValue(1);
    });

    const anims = particles.map((p, i) =>
      Animated.sequence([
        Animated.delay(i * 18),
        Animated.parallel([
          Animated.timing(p.y,   { toValue: H + 40, duration: 1800 + Math.random() * 1200, useNativeDriver: true }),
          Animated.timing(p.rot, { toValue: 360 * (Math.random() > 0.5 ? 3 : -3), duration: 2000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.op, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(1200),
            Animated.timing(p.op, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        ]),
      ])
    );

    Animated.parallel(anims).start(() => onComplete?.());
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x as any,
            width:  p.size,
            height: p.size,
            borderRadius: p.isCircle ? p.size / 2 : 2,
            backgroundColor: p.color,
            opacity: p.op,
            transform: [
              { translateY: p.y },
              { rotate: p.rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
            ],
          }}
        />
      ))}
    </View>
  );
};
