import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing } from '../constants/theme';
import { StorageService } from '../utils/storage';
import { MOTIVATIONAL_QUOTES } from '../data/examPresets';

const { width: W, height: H } = Dimensions.get('window');

// Each row: the bold first letter + rest of word + underline
const ROWS: { letter: string; rest: string }[] = [
  { letter: 'T', rest: 'HERE' },
  { letter: 'I', rest: 'S'    },
  { letter: 'N', rest: 'O'    },
  { letter: 'T', rest: 'OMORROW' },
];

// Outward ray directions (towards corners + edges)
const RAY_ANGLES = [
  -135, -90, -45,
  180,         0,
   135,  90,  45,
];

interface Props {
  onFinish: (hasUser: boolean) => void;
}

export const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  const [quote] = useState(
    () => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );

  // TINT block (vertical stack) — initial entrance
  const tintOpacity = useRef(new Animated.Value(0)).current;
  const tintScale   = useRef(new Animated.Value(0.85)).current;

  // Individual letter scales (pulse outward before expand)
  const letterScales = useRef(ROWS.map(() => new Animated.Value(1))).current;

  // Rays shooting outward from center
  const rayLengths  = useRef(RAY_ANGLES.map(() => new Animated.Value(0))).current;
  const rayOpacity  = useRef(RAY_ANGLES.map(() => new Animated.Value(0))).current;

  // Word expansion — width of the "rest" part (0 → 1)
  const wordWidths  = useRef(ROWS.map(() => new Animated.Value(0))).current;
  const wordOpacity = useRef(ROWS.map(() => new Animated.Value(0))).current;

  // Quote
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const quoteY       = useRef(new Animated.Value(16)).current;

  // Loading bar
  const loadingWidth = useRef(new Animated.Value(0)).current;

  // Background orbs
  const orbOpacity = useRef(new Animated.Value(0)).current;
  const orb1Scale  = useRef(new Animated.Value(0.7)).current;
  const orb2Scale  = useRef(new Animated.Value(0.9)).current;

  // Particles
  const particles = useRef(
    [...Array(16)].map((_, i) => ({
      x:    new Animated.Value((i * 67 + 20) % (W - 20)),
      y:    new Animated.Value(H + 10),
      op:   new Animated.Value(0),
      size: 2 + (i % 4),
      col:  i % 3 === 0 ? Colors.primary : i % 3 === 1 ? Colors.accent : Colors.primaryLight,
    }))
  ).current;

  useEffect(() => {
    // Particles
    particles.forEach((p, i) => {
      const rise = () => {
        p.y.setValue(H + 10 + Math.random() * 80);
        p.op.setValue(0);
        Animated.sequence([
          Animated.delay(i * 220 + Math.random() * 300),
          Animated.parallel([
            Animated.timing(p.op, { toValue: 0.6, duration: 600, useNativeDriver: true }),
            Animated.timing(p.y,  { toValue: -40, duration: 3000 + Math.random() * 2000, useNativeDriver: true }),
          ]),
          Animated.timing(p.op, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) rise(); });
      };
      rise();
    });

    // Orb pulses
    Animated.timing(orbOpacity, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(orb1Scale, { toValue: 1.15, duration: 3000, useNativeDriver: true }),
      Animated.timing(orb1Scale, { toValue: 0.7,  duration: 3000, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(orb2Scale, { toValue: 1.2,  duration: 3600, useNativeDriver: true }),
      Animated.timing(orb2Scale, { toValue: 0.9,  duration: 3600, useNativeDriver: true }),
    ])).start();

    // Loading bar runs entire duration (~5s)
    Animated.timing(loadingWidth, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    }).start();

    // ── Main sequence ─────────────────────────────────
    Animated.sequence([

      // 1. TINT block fades + scales in
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(tintOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(tintScale,   { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]),

      // 2. Hold
      Animated.delay(400),

      // 3. Letters pulse outward (scale up briefly)
      Animated.stagger(60, letterScales.map(s =>
        Animated.sequence([
          Animated.timing(s, { toValue: 1.18, duration: 160, useNativeDriver: true }),
          Animated.timing(s, { toValue: 1.0,  duration: 160, useNativeDriver: true }),
        ])
      )),

      // 4. Rays shoot out to corners
      Animated.parallel([
        ...rayLengths.map((r, i) =>
          Animated.sequence([
            Animated.delay(i * 30),
            Animated.timing(r, { toValue: 1, duration: 320, useNativeDriver: false }),
          ])
        ),
        ...rayOpacity.map((o, i) =>
          Animated.sequence([
            Animated.delay(i * 30),
            Animated.timing(o, { toValue: 0.55, duration: 150, useNativeDriver: true }),
            Animated.timing(o, { toValue: 0,    duration: 250, delay: 100, useNativeDriver: true }),
          ])
        ),
      ]),

      // 5. Words expand right from each letter
      Animated.stagger(80, ROWS.map((_, i) =>
        Animated.parallel([
          Animated.spring(wordWidths[i],  { toValue: 1, tension: 90, friction: 10, useNativeDriver: false }),
          Animated.timing(wordOpacity[i], { toValue: 1, duration: 300, useNativeDriver: true }),
        ])
      )),

      // 6. Quote appears
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(quoteOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(quoteY,       { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),

      Animated.delay(1400),

    ]).start(async () => {
      const user = await StorageService.getUser();
      onFinish(!!user);
    });
  }, []);

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
          left: p.x as any, width: p.size, height: p.size,
          borderRadius: p.size / 2, backgroundColor: p.col,
          opacity: p.op, transform: [{ translateY: p.y }],
        }]} />
      ))}

      {/* ── Center content ── */}
      <View style={styles.content}>

        {/* TINT vertical block + rays */}
        <View style={styles.stageWrapper}>

          {/* Rays — absolutely positioned from center */}
          {RAY_ANGLES.map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.ray,
                  {
                    opacity: rayOpacity[i],
                    width: rayLengths[i].interpolate({ inputRange: [0, 1], outputRange: [0, 90] }),
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}

          {/* TINT vertical stack */}
          <Animated.View style={[styles.tintBlock, {
            opacity: tintOpacity,
            transform: [{ scale: tintScale }],
          }]}>
            {ROWS.map((row, i) => (
              <View key={i} style={styles.row}>
                {/* Big bold letter */}
                <Animated.Text style={[styles.bigLetter, {
                  transform: [{ scale: letterScales[i] }],
                }]}>
                  {row.letter}
                </Animated.Text>

                {/* Expanding word */}
                <Animated.View style={[styles.restWrapper, {
                  opacity: wordOpacity[i],
                  maxWidth: wordWidths[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 240],
                  }),
                }]}>
                  <Text style={styles.restWord} numberOfLines={1}>
                    {row.rest}
                  </Text>
                  {/* Underline */}
                  <View style={styles.underline} />
                </Animated.View>
              </View>
            ))}
          </Animated.View>

        </View>

        {/* Quote */}
        <Animated.View style={[styles.quoteWrapper, {
          opacity: quoteOpacity,
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
  container: {
    flex: 1,
    backgroundColor: '#050010',
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbTL: {
    width: 400, height: 400,
    top: -140, left: -120,
    backgroundColor: '#7C3AED',
    opacity: 0.11,
  },
  orbBR: {
    width: 340, height: 340,
    bottom: -100, right: -80,
    backgroundColor: '#F59E0B',
    opacity: 0.08,
  },
  particle: {
    position: 'absolute',
    bottom: 0,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    paddingHorizontal: Spacing.xl,
  },

  // Stage holds rays + tint block
  stageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rays
  ray: {
    position: 'absolute',
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    transformOrigin: 'left center',
    left: '50%',
    top: '50%',
  },

  // TINT vertical block
  tintBlock: {
    alignItems: 'flex-start',
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  bigLetter: {
    fontSize: 72,
    fontWeight: '900',
    color: '#F5C842',          // golden — matches Marty Supreme energy
    letterSpacing: -2,
    lineHeight: 76,
    textShadowColor: '#F5C842',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    width: 58,
    textAlign: 'center',
  },
  restWrapper: {
    overflow: 'hidden',
    paddingBottom: 4,
    marginLeft: 2,
  },
  restWord: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 1,
    lineHeight: 42,
  },
  underline: {
    height: 2.5,
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
    marginTop: 2,
  },

  // Quote
  quoteWrapper: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.xl,
  },
  quoteLine: {
    width: 44,
    height: 1,
    backgroundColor: Colors.primary + '66',
  },
  quoteText: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  quoteAuthor: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Loading bar
  loadingTrack: {
    position: 'absolute',
    bottom: 48,
    left: Spacing.xl,
    right: Spacing.xl,
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
