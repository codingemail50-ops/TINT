import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface Props {
  onDone: () => void;
}

// ── Subtle grid ────────────────────────────────────────────
const GRID = 34;
function Grid() {
  const hLines = Math.ceil(height / GRID) + 1;
  const vLines = Math.ceil(width  / GRID) + 1;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: hLines }).map((_, i) => (
        <View key={`h${i}`} style={[g.hLine, { top: i * GRID }]} />
      ))}
      {Array.from({ length: vLines }).map((_, i) => (
        <View key={`v${i}`} style={[g.vLine, { left: i * GRID }]} />
      ))}
    </View>
  );
}

// ── Shooting stars ─────────────────────────────────────────
const STAR_CONFIGS = [
  { startX: -30,  startY: 80,  angle: 22, length: 90,  delay: 200,  dur: 700 },
  { startX: 80,   startY: -20, angle: 18, length: 70,  delay: 900,  dur: 650 },
  { startX: 200,  startY: 60,  angle: 28, length: 110, delay: 1600, dur: 750 },
  { startX: -10,  startY: 200, angle: 15, length: 80,  delay: 2400, dur: 680 },
  { startX: 150,  startY: 30,  angle: 25, length: 100, delay: 3100, dur: 720 },
  { startX: 50,   startY: 140, angle: 20, length: 75,  delay: 3800, dur: 660 },
];

function ShootingStar({ startX, startY, angle, length, delay, dur }: typeof STAR_CONFIGS[0]) {
  const tx      = useRef(new Animated.Value(0)).current;
  const ty      = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rad = (angle * Math.PI) / 180;
  const dx  = Math.cos(rad) * length * 3;
  const dy  = Math.sin(rad) * length * 3;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.75, duration: 180, useNativeDriver: true }),
          Animated.delay(dur - 400),
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]),
        Animated.timing(tx, { toValue: dx, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(ty, { toValue: dy, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[ss.star, { left: startX, top: startY, width: length, opacity,
        transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${angle}deg` }] }]}
    />
  );
}

// ── Main splash ────────────────────────────────────────────
export default function AnimatedSplash({ onDone }: Props) {
  const flipAnim   = useRef(new Animated.Value(0)).current;
  const revealAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const dotScale   = useRef([0, 1, 2].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(1500),
      Animated.timing(flipAnim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(revealAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(1900),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start(() => onDone());

    const t = setTimeout(() => {
      dotScale.forEach((anim, i) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 200),
            Animated.timing(anim, { toValue: 1.8, duration: 370, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.7, duration: 370, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ])
        ).start();
      });
    }, 3100);

    return () => clearTimeout(t);
  }, []);

  const frontRotate = flipAnim.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: ['-90deg', '-90deg', '0deg'],
  });

  return (
    <View style={s.root}>

      {/* Grid */}
      <Grid />

      {/* Dark blue/indigo gradient — vertical sweep */}
      <LinearGradient
        colors={['#0A0A1E', '#0D0B2B', '#0A0A1E']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
      {/* Central indigo glow spot */}
      <LinearGradient
        colors={['rgba(79,70,229,0.22)', 'transparent']}
        style={[StyleSheet.absoluteFill]}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 0.8 }}
        pointerEvents="none"
      />

      {/* Shooting stars */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STAR_CONFIGS.map((cfg, i) => <ShootingStar key={i} {...cfg} />)}
      </View>

      {/* Centre content */}
      <View style={s.centre}>

        <View style={s.faceContainer}>
          {/* TINT — front */}
          <Animated.View style={[s.face, { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}>
            <Text style={s.tintText}>TINT</Text>
          </Animated.View>

          {/* THERE IS NO TOMORROW — back, single line */}
          <Animated.View style={[s.face, { transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}>
            <Text style={s.mainText} numberOfLines={1} adjustsFontSizeToFit>
              THERE IS NO TOMORROW
            </Text>
          </Animated.View>
        </View>

        {/* Accent line */}
        <Animated.View style={[s.accentWrap, { opacity: revealAnim }]}>
          <LinearGradient
            colors={['transparent', '#6366F1', '#818CF8', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={s.accentLine}
          />
        </Animated.View>

        {/* Quote */}
        <Animated.Text style={[s.quote, { opacity: revealAnim }]}>
          {"\"You don't rise to the level of your goals.\nYou fall to the level of your systems.\""}
        </Animated.Text>

        {/* Dots */}
        <Animated.View style={[s.dotsRow, { opacity: revealAnim }]}>
          {[{ color: '#818CF8' }, { color: '#6366F1' }, { color: '#4F46E5' }].map(({ color }, i) => (
            <Animated.View
              key={i}
              style={[s.dot, { backgroundColor: color, transform: [{ scale: dotScale[i] }] }]}
            />
          ))}
        </Animated.View>
      </View>

      {/* Fade to black */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#080818', opacity: fadeAnim }]}
        pointerEvents="none"
      />
    </View>
  );
}

const g = StyleSheet.create({
  hLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(99,102,241,0.08)' },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth,  backgroundColor: 'rgba(99,102,241,0.08)' },
});

const ss = StyleSheet.create({
  star: { position: 'absolute', height: 1.5, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 1 },
});

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    width,
    height,
    backgroundColor: '#080818',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  centre: { alignItems: 'center' },
  faceContainer: {
    width: width - 40,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    position: 'absolute',
    width: width - 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tintText: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 10,
    textAlign: 'center',
  },
  mainText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  accentWrap: { marginTop: 18, width: 220, height: 2 },
  accentLine:  { flex: 1, borderRadius: 1 },
  quote: {
    marginTop: 20,
    color: '#A5B4FC',
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '400',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 50,
  },
  dotsRow: { flexDirection: 'row', marginTop: 20, gap: 14, alignItems: 'center', height: 14 },
  dot:     { width: 6, height: 6, borderRadius: 3 },
});
