import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing } from '../constants/theme';
import { StorageService } from '../utils/storage';
import { MOTIVATIONAL_QUOTES } from '../data/examPresets';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  onFinish: (hasUser: boolean) => void;
}

export const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef([...Array(12)].map(() => ({
    x: new Animated.Value(Math.random() * W),
    y: new Animated.Value(H + 20),
    opacity: new Animated.Value(0),
  }))).current;

  const [quote] = useState(() => {
    const idx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    return MOTIVATIONAL_QUOTES[idx];
  });

  useEffect(() => {
    // Float particles up
    particleAnims.forEach((p, i) => {
      const delay = i * 200;
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(p.opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
            Animated.timing(p.y, { toValue: -20, duration: 3000 + Math.random() * 2000, useNativeDriver: true }),
          ]),
          Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    });

    // Logo entrance
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(quoteOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // Navigate after splash
    const timer = setTimeout(async () => {
      const user = await StorageService.getUser();
      onFinish(!!user);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0A0015', '#0F0020', '#080810']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient gradient orb */}
      <Animated.View style={[styles.orb, styles.orbTop, { opacity: logoOpacity }]} />
      <Animated.View style={[styles.orb, styles.orbBottom, { opacity: logoOpacity }]} />

      {/* Floating particles */}
      {particleAnims.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              left: (i * 37 + 20) % W,
              transform: [{ translateY: p.y }],
              opacity: p.opacity,
              width: i % 3 === 0 ? 4 : i % 3 === 1 ? 6 : 3,
              height: i % 3 === 0 ? 4 : i % 3 === 1 ? 6 : 3,
              borderRadius: 3,
              backgroundColor: i % 2 === 0 ? Colors.primary : Colors.accent,
            },
          ]}
        />
      ))}

      {/* Main content */}
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <LinearGradient
            colors={['#9B5CF6', '#7C3AED', '#4F46E5']}
            style={styles.logoGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.logoText}>T</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.Text style={[styles.appName, { opacity: titleOpacity }]}>
          TINT
        </Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity: titleOpacity }]}>
          there is no tomorrow
        </Animated.Text>

        <Animated.View style={[styles.quoteContainer, { opacity: quoteOpacity }]}>
          <View style={styles.quoteLine} />
          <Text style={styles.quoteText}>"{quote.text}"</Text>
          <Text style={styles.quoteAuthor}>— {quote.author}</Text>
          <View style={styles.quoteLine} />
        </Animated.View>

        <Animated.View style={[styles.loadingRow, { opacity: taglineOpacity }]}>
          <View style={styles.loadingDot} />
          <View style={[styles.loadingDot, { backgroundColor: Colors.primaryLight, marginHorizontal: 6 }]} />
          <View style={[styles.loadingDot, { backgroundColor: Colors.primary + '55' }]} />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  orb: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  orbTop: {
    top: -80,
    left: -60,
    backgroundColor: Colors.primary,
    opacity: 0.12,
  },
  orbBottom: {
    bottom: -80,
    right: -60,
    backgroundColor: Colors.accent,
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
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  logoContainer: {
    marginBottom: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 12,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 44,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -2,
  },
  appName: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 12,
    marginTop: Spacing.sm,
  },
  tagline: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    letterSpacing: 3,
    textTransform: 'lowercase',
    marginBottom: Spacing.xl,
  },
  quoteContainer: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  quoteLine: {
    width: 60,
    height: 1,
    backgroundColor: Colors.primary + '55',
  },
  quoteText: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 26,
    opacity: 0.9,
  },
  quoteAuthor: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
});
