import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts, Typography } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';

const { width: W } = Dimensions.get('window');

interface Props {
  onDone: () => void;
}

type Slide = {
  title: string;
  body: string;
  // A plain Ionicons glyph in a circular badge — omitted on the welcome
  // slide, which leads with the wordmark/tagline alone instead of an icon.
  icon?: React.ReactNode;
};

// Declared before SLIDES (which references styles.iconBadge in its literal
// icon nodes) rather than at the file's usual bottom-of-file spot — SLIDES
// is a module-level constant evaluated at import time, so styles has to
// already exist by then.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  skipBtn: { position: 'absolute', top: 58, right: Spacing.xl, zIndex: 2 },
  skipText: { fontSize: 15, color: Colors.textSecondary, fontFamily: Fonts.medium },

  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },

  iconWrap: { marginBottom: Spacing.xxl, alignItems: 'center', justifyContent: 'center' },
  iconBadge: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  title: {
    ...Typography.displayMedium, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md,
  },
  body: {
    ...Typography.bodyLarge, color: Colors.textSecondary, textAlign: 'center',
  },

  footer: { paddingHorizontal: Spacing.xl, paddingBottom: 48, alignItems: 'center', gap: Spacing.xl },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gray[700] },
  dotActive: { backgroundColor: Colors.pop, width: 18 },

  nextBtn: {
    width: '100%', backgroundColor: Colors.pop, borderRadius: BorderRadius.full,
    paddingVertical: 16, alignItems: 'center',
  },
  nextText: { fontSize: 16, fontFamily: Fonts.bold, color: '#000' },
});

const SLIDES: Slide[] = [
  {
    title: 'There is no tomorrow',
    body: "TINT helps you beat procrastination one focused session at a time — no more \"I'll start tomorrow.\"",
  },
  {
    title: 'Deep, distraction-free focus',
    body: 'Start a session and TINT blocks the apps that pull you away — Instagram, YouTube, whatever you pick — until time\'s up.',
    icon: (
      <View style={styles.iconBadge}>
        <Ionicons name="shield-checkmark" size={44} color={Colors.pop} />
      </View>
    ),
  },
  {
    title: 'Keep the flame alive',
    body: "Hit your daily focus goal and your streak grows. Miss a day, and it's back to zero.",
    icon: (
      <View style={styles.iconBadge}>
        <Ionicons name="flame" size={48} color={Colors.pop} />
      </View>
    ),
  },
  {
    title: 'Climb the leaderboard',
    body: "Add friends and see how you stack up against others prepping for the same exam.",
    icon: (
      <View style={styles.iconBadge}>
        <Ionicons name="trophy" size={44} color={Colors.pop} />
      </View>
    ),
  },
  {
    title: "You're ready",
    body: 'Pick an avatar, your exam, and a daily goal — takes less than a minute.',
    icon: (
      <View style={styles.iconBadge}>
        <Ionicons name="rocket" size={44} color={Colors.pop} />
      </View>
    ),
  },
];

const isLastSlide = (index: number) => index === SLIDES.length - 1;

// First-launch-only feature tour, shown once before the existing avatar/
// exam/goal setup — a brand-new user currently landed straight in that setup
// with zero context for what the app even does. Deliberately short (5
// screens) and skippable from the first one; returning users, a fresh login,
// and post-logout never see this again since it only sits in the one
// "genuinely first launch" branch of the boot flow.
export const WalkthroughScreen: React.FC<Props> = ({ onDone }) => {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { buttonPress } = useHaptics();

  const goToIndex = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * W, animated: true });
    setIndex(next);
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / W);
    setIndex(next);
  };

  const handleNext = () => {
    void buttonPress();
    if (isLastSlide(index)) {
      onDone();
    } else {
      goToIndex(index + 1);
    }
  };

  const handleSkip = () => {
    void buttonPress();
    onDone();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {!isLastSlide(index) && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width: W }]}>
            {slide.icon && <View style={styles.iconWrap}>{slide.icon}</View>}
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>{isLastSlide(index) ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
