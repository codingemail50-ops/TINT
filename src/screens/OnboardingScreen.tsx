import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { EXAM_TYPES, ExamType } from '../data/examPresets';
import { StorageService } from '../utils/storage';
import { useHaptics } from '../hooks/useHaptics';

const { width: W } = Dimensions.get('window');

const AVATARS = [
  '🎯','🔥','⚡','🧠','🏆',
  '🚀','💎','🦁','⚔️','🐉',
  '🌟','💫','🦋','🌙','☄️',
  '💡','🔬','⚗️','📚','🎮',
];

const STEP_LABELS = ['Avatar', 'Name', 'Email', 'Exam'];
const TOTAL_STEPS = 4;

interface Props {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep]               = useState(0);
  const [avatar, setAvatar]           = useState('🎯');
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [selectedExam, setSelectedExam] = useState<ExamType | null>(null);
  const [nameError, setNameError]     = useState('');
  const [emailError, setEmailError]   = useState('');

  // Slide transition
  const slideAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(1)).current;

  // Avatar
  const avatarScale    = useRef(new Animated.Value(1)).current;
  const avatarGlow     = useRef(new Animated.Value(0)).current;
  const avatarPulse    = useRef(new Animated.Value(1)).current;

  // Progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;

  const { buttonPress } = useHaptics();

  useEffect(() => {
    // Pulse the big avatar preview
    Animated.loop(Animated.sequence([
      Animated.timing(avatarPulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
      Animated.timing(avatarPulse, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / (TOTAL_STEPS - 1),
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const transitionTo = (next: number) => {
    const direction = next > step ? 1 : -1;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: direction * -30, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(direction * 30);
      setStep(next);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start();
    });
  };

  const onAvatarPick = (emoji: string) => {
    setAvatar(emoji);
    buttonPress();
    Animated.sequence([
      Animated.spring(avatarScale, { toValue: 1.25, tension: 200, friction: 5, useNativeDriver: true }),
      Animated.spring(avatarScale, { toValue: 1.0,  tension: 200, friction: 5, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(avatarGlow, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(avatarGlow, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const handleNext = () => {
    buttonPress();
    if (step === 1) {
      if (name.trim().length < 2) { setNameError('Need at least 2 characters.'); return; }
      setNameError('');
    }
    if (step === 2) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailError('Enter a valid email address.'); return;
      }
      setEmailError('');
    }
    if (step === TOTAL_STEPS - 1) { handleFinish(); return; }
    transitionTo(step + 1);
  };

  const handleFinish = async () => {
    if (!selectedExam) return;
    await StorageService.saveUser({
      name: name.trim(),
      email: email.trim(),
      examType: selectedExam,
      avatar,
      createdAt: new Date().toISOString(),
    });
    const state = await StorageService.getAppState();
    await StorageService.saveAppState({
      ...state,
      user: { name: name.trim(), email: email.trim(), examType: selectedExam, avatar, createdAt: new Date().toISOString() },
    });
    onComplete();
  };

  const canProceed = () => {
    if (step === TOTAL_STEPS - 1) return selectedExam !== null;
    return true;
  };

  // ── Step renderers ────────────────────────────────────

  const renderAvatarStep = () => (
    <View style={stepStyles.container}>
      <Text style={stepStyles.stepNum}>01</Text>
      <Text style={stepStyles.title}>Pick your identity</Text>
      <Text style={stepStyles.sub}>This is who you are on TINT. Choose wisely.</Text>

      {/* Big avatar preview */}
      <View style={avatarStyles.previewWrapper}>
        <Animated.View style={[avatarStyles.glowRing, {
          opacity:   avatarGlow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] }),
          transform: [{ scale: avatarGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }],
        }]} />
        <Animated.View style={[avatarStyles.preview, {
          transform: [{ scale: Animated.multiply(avatarScale, avatarPulse) }],
        }]}>
          <Text style={avatarStyles.previewEmoji}>{avatar}</Text>
        </Animated.View>
      </View>

      {/* Grid */}
      <View style={avatarStyles.grid}>
        {AVATARS.map((emoji) => {
          const isSelected = avatar === emoji;
          return (
            <TouchableOpacity
              key={emoji}
              style={[avatarStyles.cell, isSelected && avatarStyles.cellSelected]}
              onPress={() => onAvatarPick(emoji)}
              activeOpacity={0.7}
            >
              {isSelected && (
                <LinearGradient
                  colors={[Colors.primary + '55', Colors.primary + '22']}
                  style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.md }]}
                />
              )}
              <Text style={avatarStyles.cellEmoji}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={avatarStyles.hint}>You can change this anytime later</Text>
    </View>
  );

  const renderNameStep = () => (
    <View style={stepStyles.container}>
      <Text style={stepStyles.stepNum}>02</Text>
      <View style={stepStyles.avatarChip}>
        <Text style={{ fontSize: 28 }}>{avatar}</Text>
      </View>
      <Text style={stepStyles.title}>What's your name?</Text>
      <Text style={stepStyles.sub}>We'll use this to make your experience personal.</Text>
      <TextInput
        style={[stepStyles.input, nameError ? stepStyles.inputError : null]}
        value={name}
        onChangeText={t => { setName(t); setNameError(''); }}
        placeholder="Your name..."
        placeholderTextColor={Colors.textMuted}
        autoFocus
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={handleNext}
      />
      {nameError ? <Text style={stepStyles.error}>{nameError}</Text> : null}
    </View>
  );

  const renderEmailStep = () => (
    <View style={stepStyles.container}>
      <Text style={stepStyles.stepNum}>03</Text>
      <View style={stepStyles.avatarChip}>
        <Text style={{ fontSize: 28 }}>{avatar}</Text>
      </View>
      <Text style={stepStyles.title}>Hey {name || 'there'} 👋</Text>
      <Text style={stepStyles.sub}>
        Add your email to back up your streaks and data.{'\n'}
        Totally optional — skip if you prefer.
      </Text>
      <TextInput
        style={[stepStyles.input, emailError ? stepStyles.inputError : null]}
        value={email}
        onChangeText={t => { setEmail(t); setEmailError(''); }}
        placeholder="your@email.com  (optional)"
        placeholderTextColor={Colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoFocus
        returnKeyType="next"
        onSubmitEditing={handleNext}
      />
      {emailError ? <Text style={stepStyles.error}>{emailError}</Text> : null}
    </View>
  );

  const renderExamStep = () => (
    <View style={[stepStyles.container, { flex: 1 }]}>
      <Text style={stepStyles.stepNum}>04</Text>
      <Text style={stepStyles.title}>What's the goal?</Text>
      <Text style={stepStyles.sub}>
        We'll preload a daily task list tuned to your exam.
      </Text>
      <ScrollView style={{ flex: 1, marginTop: Spacing.sm }} showsVerticalScrollIndicator={false}>
        {EXAM_TYPES.map(exam => {
          const isSelected = selectedExam === exam.id;
          return (
            <TouchableOpacity
              key={exam.id}
              style={[examStyles.card, isSelected && examStyles.cardSelected]}
              onPress={() => { setSelectedExam(exam.id); buttonPress(); }}
              activeOpacity={0.75}
            >
              {isSelected && (
                <LinearGradient
                  colors={[Colors.primary + '22', 'transparent']}
                  style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.md }]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                />
              )}
              <Text style={examStyles.emoji}>{exam.emoji}</Text>
              <View style={examStyles.info}>
                <Text style={[examStyles.label, isSelected && { color: Colors.primaryLight }]}>
                  {exam.label}
                </Text>
                <Text style={examStyles.desc}>{exam.description}</Text>
              </View>
              <View style={[examStyles.radio, isSelected && examStyles.radioSelected]}>
                {isSelected && <View style={examStyles.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );

  const STEP_CONTENT = [renderAvatarStep, renderNameStep, renderEmailStep, renderExamStep];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={['#050010', '#0A0018', '#080810']} style={StyleSheet.absoluteFill} />

        {/* Background orb */}
        <View style={styles.bgOrb} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]} />
          </View>
          <View style={styles.stepDots}>
            {STEP_LABELS.map((label, i) => (
              <View key={i} style={styles.dotWrapper}>
                <View style={[styles.dot, i <= step && styles.dotActive, i === step && styles.dotCurrent]} />
                <Text style={[styles.dotLabel, i <= step && { color: Colors.primaryLight }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Content */}
        <Animated.View style={[styles.contentArea, {
          opacity:   fadeAnim,
          transform: [{ translateX: slideAnim }],
        }]}>
          {STEP_CONTENT[step]()}
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { buttonPress(); transitionTo(step - 1); }}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canProceed()}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canProceed() ? ['#A78BFA', '#7C3AED'] : [Colors.surfaceElevated, Colors.surfaceElevated]}
              style={styles.nextGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.nextText, !canProceed() && { color: Colors.textMuted }]}>
                {step === 0 ? `Lock in as ${avatar}  →`
                 : step === TOTAL_STEPS - 1 ? 'Start grinding →'
                 : 'Continue →'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ── Shared step styles ────────────────────────────────
const stepStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  stepNum: {
    fontSize: 72,
    fontWeight: '900',
    color: Colors.primary + '18',
    letterSpacing: -3,
    marginBottom: -Spacing.xl,
    lineHeight: 80,
  },
  avatarChip: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.primary + '55',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 16,
    color: Colors.textPrimary,
    fontSize: 17,
    borderWidth: 1.5,
    borderColor: Colors.border,
    fontWeight: '500',
  },
  inputError: {
    borderColor: Colors.danger + '88',
  },
  error: {
    fontSize: 13,
    color: Colors.danger,
    marginTop: -4,
  },
});

// ── Avatar styles ────────────────────────────────────
const avatarStyles = StyleSheet.create({
  previewWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 110,
    marginVertical: Spacing.md,
  },
  glowRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.primary,
  },
  preview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 2,
    borderColor: Colors.primary + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmoji: {
    fontSize: 50,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  cell: {
    width: (W - Spacing.xl * 2 - 8 * 4) / 5,
    height: (W - Spacing.xl * 2 - 8 * 4) / 5,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellSelected: {
    borderColor: Colors.primary,
  },
  cellEmoji: {
    fontSize: 26,
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    letterSpacing: 0.5,
  },
});

// ── Exam card styles ─────────────────────────────────
const examStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: Colors.primary,
  },
  emoji: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  desc: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
});

// ── Screen styles ────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050010',
  },
  bgOrb: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    top: -100,
    right: -100,
    backgroundColor: Colors.primary,
    opacity: 0.07,
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary + '88',
  },
  dotCurrent: {
    backgroundColor: Colors.primary,
    width: 14,
  },
  dotLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'web' ? 32 : 44,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  backBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  nextBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  nextBtnDisabled: {
    opacity: 0.45,
  },
  nextGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
});
