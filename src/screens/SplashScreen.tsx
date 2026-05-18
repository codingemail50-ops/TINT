import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing } from '../constants/theme';
import { StorageService } from '../utils/storage';
import { MOTIVATIONAL_QUOTES } from '../data/examPresets';

const { width: W, height: H } = Dimensions.get('window');

const LETTERS = ['T', 'I', 'N', 'T'];
const WORDS   = ['there', 'is', 'no', 'tomorrow'];

interface Props {
  onFinish: (hasUser: boolean) => void;
}

export const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  const [quote] = useState(
    () => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );

  // Logo box
  const logoY       = useRef(new Animated.Value(-100)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.7)).current;
  const logoGlow    = useRef(new Animated.Value(0)).current;

  // Individual TINT letters
  const letterOpacity = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const letterScale   = useRef(LETTERS.map(() => new Animated.Value(0.3))).current;
  const tintGroupScale = useRef(new Animated.Value(1)).current;
  const tintGroupOpacity = useRef(new Animated.Value(1)).current;

  // "there is no tomorrow" words
  const wordOpacity = useRef(WORDS.map(() => new Animated.Value(0))).current;
  const wordY       = useRef(WORDS.map(() => new Animated.Value(12))).current;

  // Quote
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const quoteY       = useRef(new Animated.Value(20)).current;

  // Background orbs — each has its own opacity + position
  const orb1Opacity = useRef(new Animated.Value(0)).current;
  const orb2Opacity = useRef(new Animated.Value(0)).current;
  const orb3Opacity = useRef(new Animated.Value(0)).current;
  const orb1Scale   = useRef(new Animated.Value(0.6)).current;
  const orb2Scale   = useRef(new Animated.Value(0.8)).current;
  const orb3Y       = useRef(new Animated.Value(0)).current;

  // Radial ripple when words appear
  const rippleScale   = useRef(new Animated.Value(0.2)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;

  // Particles
  const particles = useRef(
    [...Array(18)].map((_, i) => ({
      x:       new Animated.Value((i * 71 + 30) % (W - 20)),
      y:       new Animated.Value(H + 10),
      opacity: new Animated.Value(0),
      size:    2 + (i % 4),
      color:   i % 3 === 0 ? Colors.primary : i % 3 === 1 ? Colors.accent : Colors.primaryLight,
    }))
  ).current;

  useEffect(() => {
    // ── Particles loop ────────────────────────────────
    particles.forEach((p, i) => {
      const rise = () => {
        p.y.setValue(H + 10 + Math.random() * 60);
        p.opacity.setValue(0);
        Animated.sequence([
          Animated.delay(i * 250 + Math.random() * 400),
          Animated.parallel([
            Animated.timing(p.opacity, { toValue: 0.65, duration: 700, useNativeDriver: true }),
            Animated.timing(p.y, { toValue: -40, duration: 3200 + Math.random() * 1800, useNativeDriver: true }),
          ]),
          Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) rise(); });
      };
      rise();
    });

    // ── Background orbs ────────────────────────────────
    Animated.parallel([
      Animated.timing(orb1Opacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(orb2Opacity, { toValue: 1, duration: 1200, delay: 300, useNativeDriver: true }),
      Animated.timing(orb3Opacity, { toValue: 1, duration: 1200, delay: 600, useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(orb1Scale, { toValue: 1.15, duration: 2800, useNativeDriver: true }),
      Animated.timing(orb1Scale, { toValue: 0.6,  duration: 2800, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(orb2Scale, { toValue: 1.2,  duration: 3400, useNativeDriver: true }),
      Animated.timing(orb2Scale, { toValue: 0.8,  duration: 3400, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(orb3Y, { toValue: -30, duration: 4000, useNativeDriver: true }),
      Animated.timing(orb3Y, { toValue: 30,  duration: 4000, useNativeDriver: true }),
    ])).start();

    // Logo glow pulse (loops)
    Animated.loop(Animated.sequence([
      Animated.timing(logoGlow, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(logoGlow, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
    ])).start();

    // ── Main sequence ────────────────────────────────
    Animated.sequence([

      // 1. Logo drops in
      Animated.delay(350),
      Animated.parallel([
        Animated.spring(logoY,      { toValue: 0, tension: 70, friction: 9,  useNativeDriver: true }),
        Animated.timing(logoOpacity,{ toValue: 1, duration: 500,             useNativeDriver: true }),
        Animated.spring(logoScale,  { toValue: 1, tension: 70, friction: 9,  useNativeDriver: true }),
      ]),

      // 2. TINT letters stagger in
      Animated.delay(120),
      Animated.stagger(110,
        LETTERS.map((_, i) =>
          Animated.parallel([
            Animated.spring(letterScale[i],  { toValue: 1,    tension: 120, friction: 7, useNativeDriver: true }),
            Animated.timing(letterOpacity[i],{ toValue: 1,    duration: 280,             useNativeDriver: true }),
          ])
        )
      ),

      // 3. Hold — let TINT breathe
      Animated.delay(700),

      // 4. TINT pulses outward then fades; words materialize
      Animated.parallel([
        // TINT group: scale up then fade
        Animated.sequence([
          Animated.timing(tintGroupScale,   { toValue: 1.18, duration: 320, useNativeDriver: true }),
          Animated.timing(tintGroupScale,   { toValue: 0.95, duration: 200, useNativeDriver: true }),
        ]),
        Animated.timing(tintGroupOpacity,   { toValue: 0,    duration: 440, delay: 180, useNativeDriver: true }),

        // Ripple
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.timing(rippleOpacity, { toValue: 0.35, duration: 200, useNativeDriver: true }),
            Animated.timing(rippleScale,   { toValue: 2.2,  duration: 700, useNativeDriver: true }),
          ]),
          Animated.timing(rippleOpacity,   { toValue: 0,    duration: 300, useNativeDriver: true }),
        ]),

        // Words stagger in
        Animated.sequence([
          Animated.delay(220),
          Animated.stagger(90,
            WORDS.map((_, i) =>
              Animated.parallel([
                Animated.timing(wordOpacity[i], { toValue: 1, duration: 380, useNativeDriver: true }),
                Animated.timing(wordY[i],       { toValue: 0, duration: 380, useNativeDriver: true }),
              ])
            )
          ),
        ]),
      ]),

      // 5. Quote slides in
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(quoteOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(quoteY,       { toValue: 0, duration: 600, useNativeDriver: true }),
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
      <LinearGradient
        colors={['#050010', '#0A0018', '#080810']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Background orbs ── */}
      <Animated.View style={[styles.orb, styles.orbPurpleTL, {
        opacity: orb1Opacity, transform: [{ scale: orb1Scale }],
      }]} />
      <Animated.View style={[styles.orb, styles.orbAmberBR, {
        opacity: orb2Opacity, transform: [{ scale: orb2Scale }],
      }]} />
      <Animated.View style={[styles.orb, styles.orbBlueCenter, {
        opacity: orb3Opacity, transform: [{ translateY: orb3Y }],
      }]} />

      {/* ── Particles ── */}
      {particles.map((p, i) => (
        <Animated.View key={i} style={[styles.particle, {
          left:            p.x as any,
          width:           p.size,
          height:          p.size,
          borderRadius:    p.size / 2,
          backgroundColor: p.color,
          opacity:         p.opacity,
          transform:       [{ translateY: p.y }],
        }]} />
      ))}

      {/* ── Main content ── */}
      <View style={styles.content}>

        {/* Logo */}
        <Animated.View style={[styles.logoWrapper, {
          opacity:   logoOpacity,
          transform: [{ translateY: logoY }, { scale: logoScale }],
        }]}>
          <Animated.View style={[styles.logoGlowRing, {
            opacity:   logoGlow,
            transform: [{ scale: logoGlow.interpolate({ inputRange: [0.3, 1], outputRange: [0.9, 1.15] }) }],
          }]} />
          <LinearGradient
            colors={['#A78BFA', '#7C3AED', '#4338CA']}
            style={styles.logoBox}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.logoLetter}>T</Text>
          </LinearGradient>
        </Animated.View>

        {/* TINT + "there is no tomorrow" container */}
        <View style={styles.wordStage}>

          {/* Ripple */}
          <Animated.View style={[styles.ripple, {
            opacity:   rippleOpacity,
            transform: [{ scale: rippleScale }],
          }]} />

          {/* TINT letters */}
          <Animated.View style={[styles.tintRow, {
            opacity:   tintGroupOpacity,
            transform: [{ scale: tintGroupScale }],
          }]}>
            {LETTERS.map((letter, i) => (
              <Animated.Text key={i} style={[styles.tintLetter, {
                opacity:   letterOpacity[i],
                transform: [{ scale: letterScale[i] }],
              }]}>
                {letter}
              </Animated.Text>
            ))}
          </Animated.View>

          {/* "there is no tomorrow" */}
          <View style={[styles.taglineRow, StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
            {WORDS.map((word, i) => (
              <Animated.Text key={i} style={[styles.taglineWord, {
                opacity:   wordOpacity[i],
                transform: [{ translateY: wordY[i] }],
              }]}>
                {word}{i < WORDS.length - 1 ? ' ' : ''}
              </Animated.Text>
            ))}
          </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050010',
  },

  // Orbs
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbPurpleTL: {
    width: 380,
    height: 380,
    top: -120,
    left: -100,
    backgroundColor: '#7C3AED',
    opacity: 0.13,
  },
  orbAmberBR: {
    width: 320,
    height: 320,
    bottom: -80,
    right: -80,
    backgroundColor: '#F59E0B',
    opacity: 0.09,
  },
  orbBlueCenter: {
    width: 280,
    height: 280,
    top: H * 0.3,
    left: W / 2 - 140,
    backgroundColor: '#4338CA',
    opacity: 0.07,
  },

  // Particles
  particle: {
    position: 'absolute',
    bottom: 0,
  },

  // Content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingHorizontal: Spacing.xl,
  },

  // Logo
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlowRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 34,
    backgroundColor: '#7C3AED',
    opacity: 0.45,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 16,
  },
  logoLetter: {
    fontSize: 50,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -2,
  },

  // Word stage
  wordStage: {
    height: 72,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Ripple
  ripple: {
    position: 'absolute',
    width: 160,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },

  // TINT
  tintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tintLetter: {
    fontSize: 64,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 2,
    textShadowColor: Colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },

  // Tagline
  taglineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taglineWord: {
    fontSize: 22,
    fontWeight: '300',
    color: Colors.textPrimary,
    letterSpacing: 4,
    textTransform: 'lowercase',
  },

  // Quote
  quoteWrapper: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  quoteLine: {
    width: 48,
    height: 1,
    backgroundColor: Colors.primary + '66',
  },
  quoteText: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  quoteAuthor: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
});
