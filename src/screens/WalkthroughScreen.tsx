import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput,
  KeyboardAvoidingView, Platform, Animated, Easing,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts, Typography } from '../constants/theme';
import { Bonfire } from '../components/Bonfire';
import { PixelIcon } from '../components/PixelIcon';
import { useHaptics } from '../hooks/useHaptics';

const { width: W } = Dimensions.get('window');

// Ad hoc for now — not yet part of UserProfile/Supabase, just so the goal
// someone types on the reality-check screen isn't thrown away the moment
// they move on. Promote to real profile storage once the persistence story
// for this field is decided.
export const YEAR_GOAL_STORAGE_KEY = 'tint:onboarding_year_goal';

interface Props {
  onDone: () => void;
}

// A slow, continuous breathing loop — used on the mock-UI screens (2 and 3)
// to keep them visibly alive even though, unlike the flame, they have
// nothing that "naturally" animates on its own.
function usePulse(duration = 1400, min = 0.94, max = 1) {
  const value = useRef(new Animated.Value(min)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: max, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: min, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration, min, max]);
  return value;
}

// ── Screen 1 — hook + motivational goal ─────────────────────────────────
const HookSlide: React.FC = () => (
  <View style={styles.slideInner}>
    <View style={styles.flameWrap}>
      <Bonfire progress={0.75} streak={5} maxHeight={140} />
    </View>
    <Text style={styles.eyebrow}>THERE IS NO TOMORROW</Text>
    <Text style={styles.title}>Whatever you're chasing, it starts today.</Text>
    <Text style={styles.body}>TINT keeps you locked in on the work that gets you there — one focused day at a time.</Text>
  </View>
);

// ── Screen 2 — "Lock In" feature tour, with a mocked UI preview ─────────
const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'shield-checkmark', label: 'App blocking' },
  { icon: 'checkbox', label: 'Structured tasks' },
  { icon: 'timer', label: 'Focus timer' },
];

const LockInSlide: React.FC = () => {
  const pulse = usePulse();
  return (
    <View style={styles.slideInner}>
      <Text style={styles.eyebrow}>LOCK IN</Text>
      <Text style={styles.title}>Everything you need to lock in.</Text>
      <Text style={styles.body}>Block distracting apps, structure your tasks, and run a focus timer — all built to keep momentum, not just track it.</Text>

      <View style={styles.featureRow}>
        {FEATURES.map(f => (
          <View key={f.label} style={styles.featurePill}>
            <Ionicons name={f.icon} size={16} color={Colors.pop} />
            <Text style={styles.featurePillText}>{f.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.mockCard}>
        <Text style={styles.mockCardHeader}>TODAY</Text>

        <View style={styles.mockTaskRow}>
          <View style={styles.mockCheckbox} />
          <Text style={styles.mockTaskLabel}>Finish practice set</Text>
          <Animated.View style={[styles.mockTag, { transform: [{ scale: pulse }] }]}>
            <Text style={styles.mockTagText}>High Priority</Text>
          </Animated.View>
        </View>

        <View style={styles.mockDivider} />

        <View style={styles.mockTimerRow}>
          <Ionicons name="timer-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.mockTimerLabel}>Focus Timer</Text>
          <Text style={styles.mockTimerValue}>25:00</Text>
        </View>
      </View>
    </View>
  );
};

// ── Screen 3 — friends / compete ────────────────────────────────────────
const MOCK_RANKS: { avatar: string; name: string; streak: number; you?: boolean }[] = [
  { avatar: 'fox', name: 'Aarav', streak: 12 },
  { avatar: 'panda', name: 'You', streak: 9, you: true },
  { avatar: 'owl', name: 'Zara', streak: 7 },
];

const CompeteSlide: React.FC = () => {
  const pulse = usePulse(1100, 0.97, 1.03);
  return (
    <View style={styles.slideInner}>
      <Text style={styles.eyebrow}>COMPETE</Text>
      <Text style={styles.title}>Who's actually locked in?</Text>
      <Text style={styles.body}>Add friends and climb the leaderboard together — same exam, same grind, real competition.</Text>

      <View style={styles.mockCard}>
        <Text style={styles.mockCardHeader}>SQUAD</Text>
        {MOCK_RANKS.map((r, i) => (
          <Animated.View
            key={r.name}
            style={[styles.mockRankRow, r.you && styles.mockRankRowYou, r.you && { transform: [{ scale: pulse }] }]}
          >
            <Text style={[styles.mockRank, r.you && styles.mockRankYou]}>{i + 1}</Text>
            <View style={styles.mockAvatar}>
              <PixelIcon name={r.avatar} size={20} />
            </View>
            <Text style={[styles.mockRankName, r.you && styles.mockRankNameYou]}>{r.name}</Text>
            <Ionicons name="flame" size={14} color={r.you ? Colors.background : Colors.pop} />
            <Text style={[styles.mockRankStreak, r.you && styles.mockRankNameYou]}>{r.streak}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

// ── Screen 4 — reality check + interactive goal, ends the walkthrough ──
const RealitySlide: React.FC<{ goal: string; onChangeGoal: (v: string) => void }> = ({ goal, onChangeGoal }) => (
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.slideInner}>
    <Text style={styles.eyebrow}>REALITY CHECK</Text>
    <Text style={styles.title}>Fast forward to December 31st.</Text>
    <Text style={styles.body}>
      One version of you kept every promise you made yourself this year. The other's still waiting for "tomorrow." Which one are you?
    </Text>

    <View style={styles.goalBox}>
      <Text style={styles.goalLabel}>THE ONE GOAL YOU'RE LOCKING IN FOR</Text>
      <TextInput
        style={styles.goalInput}
        value={goal}
        onChangeText={onChangeGoal}
        placeholder="AIR 1, Rank 1, whatever it is"
        placeholderTextColor={Colors.textMuted}
        returnKeyType="done"
        maxLength={60}
      />
    </View>
  </KeyboardAvoidingView>
);

const SLIDE_COUNT = 4;
const isLastSlide = (index: number) => index === SLIDE_COUNT - 1;

// Short, skippable feature tour shown once on a genuinely first launch —
// leads with the emotional hook (not a feature explainer), positions
// blocking/tasks/timer as supporting tools rather than the headline, then
// closes on an interactive reality-check that actually captures the user's
// own goal instead of just telling them to set one later.
export const WalkthroughScreen: React.FC<Props> = ({ onDone }) => {
  const [index, setIndex] = useState(0);
  const [goal, setGoal] = useState('');
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
      const trimmed = goal.trim();
      if (trimmed) void AsyncStorage.setItem(YEAR_GOAL_STORAGE_KEY, trimmed);
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
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        <View style={{ width: W }}><HookSlide /></View>
        <View style={{ width: W }}><LockInSlide /></View>
        <View style={{ width: W }}><CompeteSlide /></View>
        <View style={{ width: W }}><RealitySlide goal={goal} onChangeGoal={setGoal} /></View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>{isLastSlide(index) ? 'Lock It In' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  skipBtn: { position: 'absolute', top: 58, right: Spacing.xl, zIndex: 2 },
  skipText: { fontSize: 15, color: Colors.textSecondary, fontFamily: Fonts.medium },

  slideInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingTop: 70 },

  flameWrap: { marginBottom: Spacing.lg },

  eyebrow: {
    fontFamily: Fonts.pixel, fontSize: 18, color: Colors.pop,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.displayMedium, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md,
  },
  body: {
    ...Typography.bodyLarge, color: Colors.textSecondary, textAlign: 'center',
  },

  featureRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.xl },
  featurePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.full, paddingVertical: 7, paddingHorizontal: 12,
  },
  featurePillText: { fontSize: 12, fontFamily: Fonts.semibold, color: Colors.textPrimary },

  mockCard: {
    width: '100%', marginTop: Spacing.xl,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg,
    transform: [{ rotate: '-1.5deg' }],
  },
  mockCardHeader: {
    fontSize: 11, fontFamily: Fonts.bold, color: Colors.textMuted, letterSpacing: 1.5, marginBottom: Spacing.md,
  },
  mockTaskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mockCheckbox: {
    width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.textMuted,
  },
  mockTaskLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.medium, color: Colors.textPrimary },
  mockTag: { backgroundColor: Colors.popGlow, borderRadius: BorderRadius.sm, paddingVertical: 4, paddingHorizontal: 8 },
  mockTagText: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.pop },
  mockDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  mockTimerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mockTimerLabel: { flex: 1, fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSecondary },
  mockTimerValue: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: 0.5 },

  mockRankRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 9, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md,
  },
  mockRankRowYou: { backgroundColor: Colors.pop },
  mockRank: { width: 16, fontSize: 13, fontFamily: Fonts.bold, color: Colors.textMuted },
  mockRankYou: { color: Colors.background },
  mockAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  mockRankName: { flex: 1, fontSize: 14, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  mockRankNameYou: { color: Colors.background },
  mockRankStreak: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textPrimary },

  goalBox: { width: '100%', marginTop: Spacing.xl },
  goalLabel: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.sm, textAlign: 'center' },
  goalInput: {
    borderWidth: 1.5, borderColor: Colors.pop, borderRadius: BorderRadius.md,
    paddingVertical: 14, paddingHorizontal: Spacing.md,
    fontSize: 16, fontFamily: Fonts.semibold, color: Colors.textPrimary, textAlign: 'center',
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
