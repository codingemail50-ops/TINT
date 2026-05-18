import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing } from '../constants/theme';
import { StorageService } from '../utils/storage';
import { MOTIVATIONAL_QUOTES } from '../data/examPresets';

const { width: W, height: H } = Dimensions.get('window');

// Ray directions outward from center
const RAY_ANGLES = [-135, -90, -45, 180, 0, 135, 90, 45];

interface Props {
  onFinish: (hasUser: boolean) => void;
}

export const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  const [quote] = useState(
    () => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );

  // Phase 1 — TINT horizontal entrance
  const tintOpacity = useRef(new Animated.Value(0)).current;
  const tintY       = useRef(new Animated.Value(-30)).current;

  // Individual letter scales for pulse
  const letterScales = useRef(['T','I','N','T'].map(() => new Animated.Value(1))).current;

  // Phase 2 — rays
  const rayLengths = useRef(RAY_ANGLES.map(() => new Animated.Value(0))).current;
  const rayOpacity = useRef(RAY_ANGLES.map(() => new Animated.Value(0))).current;

  // Phase 3 — TINT fades out, word rows fade in
  const tintFade    = useRef(new Animated.Value(1)).current;

  // Four word rows slide in from left
  const rowsOpacity = useRef([0,1,2,3].map(() => new Animated.Value(0))).current;
  const rowsX       = useRef([0,1,2,3].map(() => new Animated.Value(-20))).current;

  // Quote + loading
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const quoteY       = useRef(new Animated.Value(14)).current;
  const loadingWidth = useRef(new Animated.Value(0)).current;

  // Orbs + particles
  const orbOpacity = useRef(new Animated.Value(0)).current;
  const orb1Scale  = useRef(new Animated.Value(0.7)).current;
  const orb2Scale  = useRef(new Animated.Value(0.9)).current;
  const particles  = useRef(
    [...Array(16)].map((_, i) => ({
      x:   new Animated.Value((i * 67 + 20) % (W - 20)),
      y:   new Animated.Value(H + 10),
      op:  new Animated.Value(0),
      sz:  2 + (i % 4),
      col: i % 3 === 0 ? Colors.primary : i % 3 === 1 ? Colors.accent : Colors.primaryLight,
    }))
  ).current;

  useEffect(() => {
    // Particles rising
    particles.forEach((p, i) => {
      const rise = () => {
        p.y.setValue(H + 10 + Math.random() * 80);
        p.op.setValue(0);
        Animated.sequence([
          Animated.delay(i * 200 + Math.random() * 300),
          Animated.parallel([
            Animated.timing(p.op, { toValue: 0.55, duration: 600, useNativeDriver: true }),
            Animated.timing(p.y,  { toValue: -40,  duration: 3200 + Math.random() * 2000, useNativeDriver: true }),
          ]),
          Animated.timing(p.op, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) rise(); });
      };
      rise();
    });

    // Orbs
    Animated.timing(orbOpacity, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(orb1Scale, { toValue: 1.15, duration: 3000, useNativeDriver: true }),
      Animated.timing(orb1Scale, { toValue: 0.7,  duration: 3000, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(orb2Scale, { toValue: 1.2,  duration: 3600, useNativeDriver: true }),
      Animated.timing(orb2Scale, { toValue: 0.9,  duration: 3600, useNativeDriver: true }),
    ])).start();

    // Loading bar
    Animated.timing(loadingWidth, { toValue: 1, duration: 5200, useNativeDriver: false }).start();

    // ── Main sequence ─────────────────────────────────
    Animated.sequence([

      // 1. TINT slides up and fades in
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(tintOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(tintY,       { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),

      // 2. Letters pulse one by one
      Animated.delay(250),
      Animated.stagger(70, letterScales.map(s =>
        Animated.sequence([
          Animated.timing(s, { toValue: 1.2,  duration: 140, useNativeDriver: true }),
          Animated.timing(s, { toValue: 1.0,  duration: 140, useNativeDriver: true }),
        ])
      )),

      // 3. Rays burst outward
      Animated.parallel([
        ...RAY_ANGLES.map((_, i) =>
          Animated.sequence([
            Animated.delay(i * 25),
            Animated.timing(rayLengths[i], { toValue: 1, duration: 280, useNativeDriver: false }),
          ])
        ),
        ...RAY_ANGLES.map((_, i) =>
          Animated.sequence([
            Animated.delay(i * 25),
            Animated.timing(rayOpacity[i], { toValue: 0.6, duration: 120, useNativeDriver: true }),
            Animated.timing(rayOpacity[i], { toValue: 0,   duration: 220, useNativeDriver: true }),
          ])
        ),
      ]),

      // 4. TINT fades out, word rows stagger in
      Animated.parallel([
        Animated.timing(tintFade, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(100),
          Animated.stagger(110, [0,1,2,3].map(i =>
            Animated.parallel([
              Animated.timing(rowsOpacity[i], { toValue: 1, duration: 350, useNativeDriver: true }),
              Animated.timing(rowsX[i],       { toValue: 0, duration: 350, useNativeDriver: true }),
            ])
          )),
        ]),
      ]),

      // 5. Quote
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(quoteOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(quoteY,       { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),

      Animated.delay(1600),

    ]).start(async () => {
      const user = await StorageService.getUser();
      onFinish(!!user);
    });
  }, []);

  const ROWS = [
    { letter: 'T', word: 'HERE' },
    { letter: 'I', word: 'S'    },
    { letter: 'N', word: 'O'    },
    { letter: 'T', word: 'OMORROW' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#050010', '#0A0018', '#08080F']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Orbs */}
      <Animated.View style={[styles.orb, styles.orbTL, { opacity: orbOpacity, transform: [{ scale: orb1Scale }] }]} />
      <Animated.View style={[styles.orb, styles.orbBR, { opacity: orbOpacity, transform: [{ scale: orb2Scale }] }]} />

      {/* Particles */}
      {particles.map((p, i) => (
        <Animated.View key={i} style={[styles.particle, {
          left: p.x as any, width: p.sz, height: p.sz,
          borderRadius: p.sz / 2, backgroundColor: p.col,
          opacity: p.op, transform: [{ translateY: p.y }],
        }]} />
      ))}

      <View style={styles.content}>

        {/* ── Phase 1: TINT horizontal ── */}
        <Animated.View style={[styles.tintRow, {
          opacity: Animated.multiply(tintOpacity, tintFade),
          transform: [{ translateY: tintY }],
        }]}>
          {['T','I','N','T'].map((letter, i) => (
            <Animated.Text key={i} style={[styles.tintLetter, {
              transform: [{ scale: letterScales[i] }],
            }]}>
              {letter}
            </Animated.Text>
          ))}
        </Animated.View>

        {/* Rays — centered behind TINT */}
        <View style={styles.rayOrigin} pointerEvents="none">
          {RAY_ANGLES.map((angle, i) => (
            <Animated.View key={i} style={[styles.ray, {
              opacity: rayOpacity[i],
              width: rayLengths[i].interpolate({ inputRange: [0, 1], outputRange: [0, 100] }),
              transform: [{ rotate: `${angle}deg` }],
            }]} />
          ))}
        </View>

        {/* ── Phase 2: Expanded word rows ── */}
        <View style={styles.wordBlock}>
          {ROWS.map((row, i) => (
            <Animated.View key={i} style={[styles.wordRow, {
              opacity:   rowsOpacity[i],
              transform: [{ translateX: rowsX[i] }],
            }]}>
              {/* Big golden letter */}
              <Text style={styles.wordLetter}>{row.letter}</Text>
              {/* Rest of word + underline */}
              <View style={styles.wordRestCol}>
                <Text style={styles.wordRest}>{row.word}</Text>
                <View style={styles.underline} />
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Quote */}
        <Animated.View style={[styles.quoteWrapper, {
          opacity:   quoteOpacity,
          transform: [{ translateY: quoteY }],
        }]}>
          <View style={styles.quoteLine} />
          <Text style={styles.quoteText}>"{quote.text}"</Text>
          <Text style={styles.quoteAuthor}>— {quote.author}</Text>
          <View style={styles.quoteLine} />
        </Animated.View>

      </View>

      {/* Loading bar */}
      <View style={styles.loadingTrack}>
        <Animated.View style={[styles.loadingFill, {
          width: loadingWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050010' },

  orb: { position: 'absolute', borderRadius: 9999 },
  orbTL: { width: 400, height: 400, top: -140, left: -120, backgroundColor: '#7C3AED', opacity: 0.11 },
  orbBR: { width: 340, height: 340, bottom: -100, right: -80, backgroundColor: '#F59E0B', opacity: 0.08 },

  particle: { position: 'absolute', bottom: 0 },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    paddingHorizontal: Spacing.xl,
  },

  // Phase 1 — TINT horizontal
  tintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'absolute',
  },
  tintLetter: {
    fontSize: 80,
    fontWeight: '900',
    color: '#F5C518',
    letterSpacing: -1,
    textShadowColor: '#F5C518',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },

  // Rays
  rayOrigin: {
    position: 'absolute',
    width: 2,
    height: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#F5C518',
    borderRadius: 2,
    left: 0,
    top: 0,
    transformOrigin: '0% 50%',
  },

  // Phase 2 — word rows
  wordBlock: {
    alignItems: 'flex-start',
    gap: 2,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 0,
  },
  wordLetter: {
    fontSize: 72,
    fontWeight: '900',
    color: '#F5C518',
    letterSpacing: -1,
    lineHeight: 80,
    width: 54,
    textAlign: 'center',
    textShadowColor: '#F5C518',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  wordRestCol: {
    paddingBottom: 8,
    marginLeft: 4,
  },
  wordRest: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 2,
    lineHeight: 46,
  },
  underline: {
    height: 2.5,
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
    marginTop: 1,
  },

  // Quote
  quoteWrapper: { alignItems: 'center', gap: 10, paddingHorizontal: Spacing.xl },
  quoteLine:    { width: 44, height: 1, backgroundColor: Colors.primary + '66' },
  quoteText:    { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },
  quoteAuthor:  { fontSize: 11, fontWeight: '600', color: Colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Loading bar
  loadingTrack: {
    position: 'absolute', bottom: 48,
    left: Spacing.xl, right: Spacing.xl,
    height: 3, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden',
  },
  loadingFill: {
    height: '100%', backgroundColor: Colors.primary, borderRadius: 2,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 6,
  },
});
