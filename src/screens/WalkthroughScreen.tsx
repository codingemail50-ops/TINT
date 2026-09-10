import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput, Image,
  Animated, Easing, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors, Spacing, BorderRadius, Fonts, Typography } from '../constants/theme';
import { Bonfire } from '../components/Bonfire';
import { PixelIcon } from '../components/PixelIcon';
import { PixelFlame } from '../components/PixelFlame';
import { WalkthroughIcon } from '../components/WalkthroughIcon';
import { DateWheelPicker } from '../components/DateWheelPicker';
import { FutureGoal } from '../utils/storage';
import { useHaptics } from '../hooks/useHaptics';

const { width: W } = Dimensions.get('window');

// Native <Image> sizing via aspectRatio + percentage width doesn't reliably
// scale on RN Web (it falls back to the source's raw pixel height), so the
// screenshot assets below are sized with explicit computed pixel dimensions.
const TASK_IMG_W = W * 0.78;
const TASK_IMG_H = TASK_IMG_W * (1270 / 980);
const DIAL_IMG_W = W * 0.46;
const DIAL_IMG_H = DIAL_IMG_W * (610 / 710);

interface Props {
  onDone: (futureGoal?: FutureGoal) => void;
}

// A slow, continuous breathing loop — keeps the mock-UI screens visibly
// alive even though, unlike the flame, they have nothing that "naturally"
// animates on its own.
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

function useFadeIn(delay: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(value, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start();
  }, [value, delay]);
  return value;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
function formatGoalDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${d}, ${y}`;
}

// ── Screen 1 — the problem, not a feature pitch ─────────────────────────
const ProblemSlide: React.FC = () => {
  const revealOpacity = useFadeIn(700);
  return (
    <View style={styles.slideInner}>
      <View style={styles.flameWrap}>
        <Bonfire progress={0.5} streak={3} maxHeight={100} />
      </View>
      <Text style={styles.title}>You know what you want to do, but you're not able to do it.</Text>
      <Animated.Text style={[styles.reveal, { opacity: revealOpacity }]}>That's what TINT is for.</Animated.Text>
    </View>
  );
};

// ── Screen 2 — structure your day ───────────────────────────────────────
const TaskSlide: React.FC = () => {
  return (
    <View style={styles.slideInner}>
      <WalkthroughIcon name="checklist" size={40} style={{ marginBottom: Spacing.md }} />
      <Text style={styles.eyebrow}>TODAY</Text>
      <Text style={styles.title}>Prioritize your tasks.</Text>
      <Text style={styles.bodyBig}>Add what you need to do. Mark what matters most. Focus on that first.</Text>

      <Image
        source={require('../../assets/walkthrough/task-panels.png')}
        style={styles.screenshotTask}
        resizeMode="contain"
      />
    </View>
  );
};

// ── Screen 3 — block distractions, the real dial as the visual ─────────
const FocusSlide: React.FC = () => {
  return (
    <View style={styles.slideInner}>
      <WalkthroughIcon name="shield" size={40} style={{ marginBottom: Spacing.md }} />
      <Text style={styles.eyebrow}>FOCUS</Text>
      <Text style={styles.title}>We've locked in, but we need to stay locked in.</Text>
      <Text style={styles.body}>Set your time. Block all distractions. Get the real dopamine hit that you're one step closer to your goal — every day.</Text>

      <Image
        source={require('../../assets/walkthrough/focus-dial.png')}
        style={styles.screenshotDial}
        resizeMode="contain"
      />
    </View>
  );
};

// ── Screen 4 — lock in together ──────────────────────────────────────────
const MOCK_RANKS: { avatar: string; name: string; streak: number; you?: boolean }[] = [
  { avatar: 'fox', name: 'Aarav', streak: 12 },
  { avatar: 'panda', name: 'You', streak: 9, you: true },
  { avatar: 'owl', name: 'Zara', streak: 7 },
];

const SquadSlide: React.FC = () => {
  const pulse = usePulse(1100, 0.97, 1.03);
  return (
    <View style={styles.slideInner}>
      <WalkthroughIcon name="trophy" size={40} style={{ marginBottom: Spacing.md }} />
      <Text style={styles.eyebrow}>SQUAD</Text>
      <Text style={styles.title}>Find out who's actually putting in the hours.</Text>
      <Text style={styles.body}>Add your friends. Push each other's limits. Lock in together.</Text>

      <View style={[styles.mockCard, styles.mockCardLower]}>
        <View style={styles.mockSquadHeader}>
          <Text style={styles.mockCardHeader}>SQUAD</Text>
          <View style={styles.mockAddFriendPill}>
            <Text style={styles.mockAddFriendText}>+ Add a friend</Text>
          </View>
        </View>
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
            <PixelFlame size={14} state="static" />
            <Text style={[styles.mockRankStreak, r.you && styles.mockRankNameYou]}>{r.streak}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

// ── Screen 5 — your future self, the interactive one ────────────────────
interface FutureSlideProps {
  goalText: string;
  onChangeGoalText: (v: string) => void;
  goalDate: string | null;
  onOpenDatePicker: () => void;
  confirmed: boolean;
  onConfirm: () => void;
  onLockIn: () => void;
}

const FutureSlide: React.FC<FutureSlideProps> = ({
  goalText, onChangeGoalText, goalDate, onOpenDatePicker, confirmed, onConfirm, onLockIn,
}) => {
  const canConfirm = goalText.trim().length >= 2 && !!goalDate;
  const revealOpacity = useFadeIn(150);

  if (confirmed && goalDate) {
    return (
      <View style={styles.slideInner}>
        <WalkthroughIcon name="flag" size={44} style={{ marginBottom: Spacing.lg }} />
        <Animated.View style={{ opacity: revealOpacity, alignItems: 'center' }}>
          <Text style={styles.revealDate}>{formatGoalDate(goalDate)}</Text>
          <Text style={styles.revealGoal}>{goalText}</Text>
          <Text style={styles.revealLine}>That's where you're going.</Text>
          <Text style={styles.revealLine}>Today is one of the days that gets you there.</Text>
        </Animated.View>
        <TouchableOpacity style={styles.lockInBtn} onPress={onLockIn} activeOpacity={0.85}>
          <Text style={styles.lockInText}>Let's lock in.</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.slideInner}>
      <Text style={styles.eyebrow}>YOUR FUTURE SELF</Text>
      <Text style={styles.title}>Where do you want to be?</Text>

      <View style={styles.goalBox}>
        <Text style={styles.goalLabel}>BY WHEN</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={onOpenDatePicker} activeOpacity={0.8}>
          <Text style={goalDate ? styles.dateBtnTextSet : styles.dateBtnTextEmpty}>
            {goalDate ? formatGoalDate(goalDate) : 'Pick a date'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.goalLabel, { marginTop: Spacing.lg }]}>WHAT YOU'RE GOING FOR</Text>
        <TextInput
          style={styles.goalInput}
          value={goalText}
          onChangeText={onChangeGoalText}
          placeholder="UCEED AIR 1, IIT Bombay..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="done"
          maxLength={60}
        />
      </View>

      <TouchableOpacity
        style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
        onPress={onConfirm}
        disabled={!canConfirm}
        activeOpacity={0.85}
      >
        <Text style={styles.confirmText}>That's it.</Text>
      </TouchableOpacity>
    </View>
  );
};

const SLIDE_COUNT = 5;
const isLastSlide = (index: number) => index === SLIDE_COUNT - 1;

// Short, skippable feature tour shown once on a genuinely first launch.
// Leads with the emotional problem (not a feature pitch), gives each
// practical piece of TINT its own short beat, then closes on an
// interactive commitment screen that actually captures the user's own
// goal — the central idea being future-self -> today's priority -> lock in,
// not a permanent stream of motivational quotes.
export const WalkthroughScreen: React.FC<Props> = ({ onDone }) => {
  const [index, setIndex] = useState(0);
  const [goalText, setGoalText] = useState('');
  const [goalDate, setGoalDate] = useState<string | null>(null);
  const [goalConfirmed, setGoalConfirmed] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pageHeight, setPageHeight] = useState(0);
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
    goToIndex(index + 1);
  };

  const handleSkip = () => {
    void buttonPress();
    onDone();
  };

  const handleConfirmGoal = () => {
    void buttonPress();
    setGoalConfirmed(true);
  };

  const handleLockIn = () => {
    void buttonPress();
    if (goalDate && goalText.trim()) {
      onDone({ text: goalText.trim(), targetDate: goalDate });
    } else {
      onDone();
    }
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
        scrollEnabled={!isLastSlide(index)}
        onMomentumScrollEnd={handleMomentumEnd}
        onLayout={e => setPageHeight(e.nativeEvent.layout.height)}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        <View style={{ width: W, height: pageHeight || undefined }}><ProblemSlide /></View>
        <View style={{ width: W, height: pageHeight || undefined }}><TaskSlide /></View>
        <View style={{ width: W, height: pageHeight || undefined }}><FocusSlide /></View>
        <View style={{ width: W, height: pageHeight || undefined }}><SquadSlide /></View>
        <View style={{ width: W, height: pageHeight || undefined }}>
          <FutureSlide
            goalText={goalText}
            onChangeGoalText={setGoalText}
            goalDate={goalDate}
            onOpenDatePicker={() => setDatePickerOpen(true)}
            confirmed={goalConfirmed}
            onConfirm={handleConfirmGoal}
            onLockIn={handleLockIn}
          />
        </View>
      </ScrollView>

      {!isLastSlide(index) && (
        <View style={styles.footer}>
          <View style={styles.dots}>
            {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      <DateWheelPicker
        visible={datePickerOpen}
        initialDate={goalDate ?? undefined}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={iso => { setGoalDate(iso); setDatePickerOpen(false); }}
        title="Where You're Going"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  skipBtn: { position: 'absolute', top: 58, right: Spacing.xl, zIndex: 2 },
  skipText: { fontSize: 15, color: Colors.textSecondary, fontFamily: Fonts.medium },

  slideInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },

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
  bodyBig: {
    ...Typography.headlineMedium, color: Colors.textSecondary, textAlign: 'center', fontFamily: Fonts.medium,
  },
  reveal: {
    fontFamily: Fonts.pixel, fontSize: 22, color: Colors.textPrimary,
    letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', marginTop: Spacing.xxl,
  },

  screenshotTask: { width: TASK_IMG_W, height: TASK_IMG_H, marginTop: Spacing.lg },
  screenshotDial: { width: DIAL_IMG_W, height: DIAL_IMG_H, marginTop: Spacing.lg },

  mockCard: {
    width: '100%', marginTop: Spacing.xl,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg,
    transform: [{ rotate: '-1.5deg' }],
  },
  mockCardLower: { marginTop: Spacing.xxl },
  mockCardHeader: {
    fontSize: 11, fontFamily: Fonts.bold, color: Colors.textMuted, letterSpacing: 1.5,
  },
  mockSquadHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md,
  },
  mockAddFriendPill: {
    backgroundColor: Colors.popGlow, borderRadius: BorderRadius.full, paddingVertical: 4, paddingHorizontal: 10,
  },
  mockAddFriendText: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.pop },

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
  goalLabel: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.sm },
  dateBtn: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingVertical: 14, paddingHorizontal: Spacing.md,
  },
  dateBtnTextEmpty: { fontSize: 16, fontFamily: Fonts.medium, color: Colors.textMuted },
  dateBtnTextSet: { fontSize: 16, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  goalInput: {
    borderWidth: 1.5, borderColor: Colors.pop, borderRadius: BorderRadius.md,
    paddingVertical: 14, paddingHorizontal: Spacing.md,
    fontSize: 16, fontFamily: Fonts.semibold, color: Colors.textPrimary,
  },

  confirmBtn: {
    width: '100%', backgroundColor: Colors.pop, borderRadius: BorderRadius.full,
    paddingVertical: 16, alignItems: 'center', marginTop: Spacing.xxl,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontSize: 16, fontFamily: Fonts.bold, color: '#000' },

  revealDate: {
    fontFamily: Fonts.pixel, fontSize: 30, color: Colors.pop, letterSpacing: 0.5, textAlign: 'center',
  },
  revealGoal: {
    ...Typography.headlineMedium, color: Colors.textPrimary, textAlign: 'center', marginTop: Spacing.sm,
  },
  revealLine: {
    ...Typography.bodyLarge, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.lg,
  },
  lockInBtn: {
    width: '100%', backgroundColor: Colors.pop, borderRadius: BorderRadius.full,
    paddingVertical: 18, alignItems: 'center', marginTop: Spacing.xxl,
  },
  lockInText: { fontSize: 17, fontFamily: Fonts.bold, color: '#000' },

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
