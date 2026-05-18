import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing } from '../constants/theme';
import { StorageService } from '../utils/storage';
import { MOTIVATIONAL_QUOTES } from '../data/examPresets';

const { width: W, height: H } = Dimensions.get('window');

// Heavy poster-style font — Impact on web, bold system on native
const DISPLAY_FONT = Platform.OS === 'web'
  ? 'Impact, "Arial Narrow Bold", "Arial Black", sans-serif'
  : undefined;

// The 4 letters of TINT and the words they expand into
const EXPANSIONS = [
  { letter: 'T', word: 'HERE' },
  { letter: 'I', word: 'S'    },
  { letter: 'N', word: 'O'    },
  { letter: 'T', word: 'OMORROW' },
];

// 8 ray directions (outward to corners + edges)
const RAY_ANGLES = [-135, -90, -45, 180, 0, 135, 90, 45];

interface Props { onFinish: (hasUser: boolean) => void }

export const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  const [quote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);

  // ── Phase 1: "TINT" horizontal ──────────────────────
  const tintOpacity  = useRef(new Animated.Value(0)).current;
  const tintY        = useRef(new Animated.Value(-40)).current;
  const letterScales = useRef(EXPANSIONS.map(() => new Animated.Value(1))).current;

  // ── Phase 2: Rays burst from center ─────────────────
  const rayLen = useRef(RAY_ANGLES.map(() => new Animated.Value(0))).current;
  const rayOp  = useRef(RAY_ANGLES.map(() => new Animated.Value(0))).current;

  // ── Phase 3: TINT crossfades to THERE IS NO TOMORROW
  const tintGroupOp = useRef(new Animated.Value(1)).current; // multiplied with tintOpacity
  // Each expanded row slides in from left
  const rowOp = useRef(EXPANSIONS.map(() => new Animated.Value(0))).current;
  const rowX  = useRef(EXPANSIONS.map(() => new Animated.Value(-28))).current;

  // ── Quote + loading ──────────────────────────────────
  const quoteOp    = useRef(new Animated.Value(0)).current;
  const quoteY     = useRef(new Animated.Value(16)).current;
  const loadWidth  = useRef(new Animated.Value(0)).current;

  // ── Background ───────────────────────────────────────
  const orbOp    = useRef(new Animated.Value(0)).current;
  const orb1Sc   = useRef(new Animated.Value(0.7)).current;
  const orb2Sc   = useRef(new Animated.Value(0.9)).current;

  const particles = useRef(
    [...Array(20)].map((_, i) => ({
      x:   new Animated.Value((i * 71 + 15) % (W - 10)),
      y:   new Animated.Value(H + 20),
      op:  new Animated.Value(0),
      sz:  2 + (i % 4),
      col: i % 3 === 0 ? Colors.primary : i % 3 === 1 ? Colors.accent : '#A78BFA',
    }))
  ).current;

  useEffect(() => {
    // Particles rise loop
    particles.forEach((p, i) => {
      const rise = () => {
        p.y.setValue(H + 20 + Math.random() * 60);
        p.op.setValue(0);
        Animated.sequence([
          Animated.delay(i * 180 + Math.random() * 300),
          Animated.parallel([
            Animated.timing(p.op, { toValue: 0.6, duration: 700, useNativeDriver: true }),
            Animated.timing(p.y,  { toValue: -40, duration: 3200 + Math.random() * 2000, useNativeDriver: true }),
          ]),
          Animated.timing(p.op, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) rise(); });
      };
      rise();
    });

    // Orbs
    Animated.timing(orbOp, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(orb1Sc, { toValue: 1.18, duration: 3200, useNativeDriver: true }),
      Animated.timing(orb1Sc, { toValue: 0.7,  duration: 3200, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(orb2Sc, { toValue: 1.25, duration: 3800, useNativeDriver: true }),
      Animated.timing(orb2Sc, { toValue: 0.9,  duration: 3800, useNativeDriver: true }),
    ])).start();

    // Loading bar runs across total duration ~5.5s
    Animated.timing(loadWidth, { toValue: 1, duration: 5500, useNativeDriver: false }).start();

    // ── Main animation sequence ──────────────────────────
    Animated.sequence([

      // 1. TINT slides up into view
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(tintOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(tintY,       { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),

      // 2. Each letter pulses outward in sequence
      Animated.delay(200),
      Animated.stagger(80, letterScales.map(s =>
        Animated.sequence([
          Animated.timing(s, { toValue: 1.22, duration: 130, useNativeDriver: true }),
          Animated.timing(s, { toValue: 1.0,  duration: 130, useNativeDriver: true }),
        ])
      )),

      // 3. Rays burst to all corners
      Animated.parallel([
        ...RAY_ANGLES.map((_, i) =>
          Animated.sequence([
            Animated.delay(i * 22),
            Animated.timing(rayLen[i], { toValue: 1, duration: 320, useNativeDriver: false }),
          ])
        ),
        ...RAY_ANGLES.map((_, i) =>
          Animated.sequence([
            Animated.delay(i * 22),
            Animated.timing(rayOp[i], { toValue: 0.65, duration: 120, useNativeDriver: true }),
            Animated.timing(rayOp[i], { toValue: 0,    duration: 280, useNativeDriver: true }),
          ])
        ),
      ]),

      // 4. TINT fades out, expanded rows slide in staggered
      Animated.parallel([
        Animated.timing(tintGroupOp, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(80),
          Animated.stagger(100, EXPANSIONS.map((_, i) =>
            Animated.parallel([
              Animated.timing(rowOp[i], { toValue: 1, duration: 320, useNativeDriver: true }),
              Animated.timing(rowX[i],  { toValue: 0, duration: 320, useNativeDriver: true }),
            ])
          )),
        ]),
      ]),

      // 5. Quote appears
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(quoteOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(quoteY,  { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),

      Animated.delay(1600),

    ]).start(async () => {
      const user = await StorageService.getUser();
      onFinish(!!user);
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#040010', '#09001A', '#07070E']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />

      {/* Orbs */}
      <Animated.View style={[styles.orb, { top: -120, left: -100, backgroundColor: '#6D28D9', opacity: orbOp, transform: [{ scale: orb1Sc }] }]} />
      <Animated.View style={[styles.orb, { bottom: -90, right: -90, backgroundColor: '#B45309', opacity: orbOp, transform: [{ scale: orb2Sc }] }]} />

      {/* Particles */}
      {particles.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', bottom: 0,
          left: p.x as any, width: p.sz, height: p.sz,
          borderRadius: p.sz / 2, backgroundColor: p.col,
          opacity: p.op, transform: [{ translateY: p.y }],
        }} />
      ))}

      <View style={styles.content}>

        {/* ── PHASE 1: TINT horizontal ── */}
        <Animated.View style={[styles.tintRow, {
          opacity:   Animated.multiply(tintOpacity, tintGroupOp),
          transform: [{ translateY: tintY }],
        }]}>
          {EXPANSIONS.map(({ letter }, i) => (
            <Animated.Text key={i} style={[styles.tintLetter, {
              transform: [{ scale: letterScales[i] }],
            }]}>
              {letter}
            </Animated.Text>
          ))}
        </Animated.View>

        {/* Rays from center */}
        <View style={styles.rayOrigin} pointerEvents="none">
          {RAY_ANGLES.map((angle, i) => (
            <Animated.View key={i} style={[styles.ray, {
              opacity: rayOp[i],
              width: rayLen[i].interpolate({ inputRange: [0, 1], outputRange: [0, 110] }),
              transform: [{ rotate: `${angle}deg` }],
            }]} />
          ))}
        </View>

        {/* ── PHASE 2: Expanded rows ── */}
        <View style={styles.expandedBlock}>
          {EXPANSIONS.map(({ letter, word }, i) => (
            <Animated.View key={i} style={[styles.expandedRow, {
              opacity:   rowOp[i],
              transform: [{ translateX: rowX[i] }],
            }]}>
              {/* First letter — big gold */}
              <Text style={styles.expandedLetter}>{letter}</Text>
              {/* Rest of word */}
              <View style={styles.expandedWordCol}>
                <Text style={styles.expandedWord}>{word}</Text>
                <View style={styles.underline} />
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Quote */}
        <Animated.View style={[styles.quoteBox, {
          opacity:   quoteOp,
          transform: [{ translateY: quoteY }],
        }]}>
          <View style={styles.quoteLine} />
          <Text style={styles.quoteText}>"{quote.text}"</Text>
          <Text style={styles.quoteAuthor}>— {quote.author}</Text>
          <View style={styles.quoteLine} />
        </Animated.View>

      </View>

      {/* Loading bar */}
      <View style={styles.loadTrack}>
        <Animated.View style={[styles.loadFill, {
          width: loadWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040010' },

  orb: {
    position: 'absolute',
    width: 380, height: 380,
    borderRadius: 190,
    opacity: 0.12,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingHorizontal: Spacing.xl,
  },

  // Phase 1 — TINT horizontal
  tintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'absolute',
  },
  tintLetter: {
    fontSize: 88,
    fontWeight: '900',
    fontFamily: DISPLAY_FONT,
    color: '#F5C518',
    letterSpacing: -2,
    textShadowColor: '#F5C51888',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
  },

  // Rays
  rayOrigin: {
    position: 'absolute',
    width: 2, height: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    height: 2,
    left: 0, top: 0,
    backgroundColor: '#F5C518',
    borderRadius: 2,
    transformOrigin: '0% 50%',
  },

  // Phase 2 — expanded rows
  expandedBlock: {
    alignItems: 'flex-start',
    gap: 2,
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  expandedLetter: {
    fontSize: 74,
    fontWeight: '900',
    fontFamily: DISPLAY_FONT,
    color: '#F5C518',
    letterSpacing: -1,
    lineHeight: 82,
    width: 52,
    textAlign: 'center',
    textShadowColor: '#F5C51866',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  expandedWordCol: {
    paddingBottom: 8,
    marginLeft: 2,
  },
  expandedWord: {
    fontSize: 42,
    fontWeight: '900',
    fontFamily: DISPLAY_FONT,
    color: '#F0F0FF',
    letterSpacing: 1,
    lineHeight: 48,
  },
  underline: {
    height: 3,
    backgroundColor: '#F0F0FF',
    borderRadius: 2,
    marginTop: 1,
  },

  // Quote
  quoteBox: { alignItems: 'center', gap: 10, paddingHorizontal: Spacing.xl },
  quoteLine: { width: 44, height: 1, backgroundColor: Colors.primary + '66' },
  quoteText: {
    fontSize: 14, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22, fontStyle: 'italic',
  },
  quoteAuthor: {
    fontSize: 11, fontWeight: '600',
    color: Colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase',
  },

  // Loading bar
  loadTrack: {
    position: 'absolute', bottom: 48,
    left: Spacing.xl, right: Spacing.xl,
    height: 3, backgroundColor: Colors.border,
    borderRadius: 2, overflow: 'hidden',
  },
  loadFill: {
    height: '100%', backgroundColor: Colors.primary, borderRadius: 2,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 6,
  },
});
