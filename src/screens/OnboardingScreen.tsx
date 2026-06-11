import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Animated, KeyboardAvoidingView, Platform, FlatList, Dimensions, ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius } from '../constants/theme';
import { EXAM_TYPES, ExamType, AVATARS } from '../data/examPresets';
import { StorageService } from '../utils/storage';
import { useHaptics } from '../hooks/useHaptics';
import { supabase } from '../lib/supabase';

const { width: W } = Dimensions.get('window');
const AVATAR_CELL = 72;

const STEPS = ['Avatar', 'Name', 'Exams', 'Sign in'];

interface Props { onComplete: () => void }

export const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep]         = useState(0);
  const [avatar, setAvatar]     = useState(AVATARS[0]);
  const [name, setName]         = useState('');
  const [nameError, setNameError] = useState('');
  const [selectedExams, setSelectedExams] = useState<Set<ExamType>>(new Set());
  const [googleLoading, setGoogleLoading] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const avatarBounce = useRef(new Animated.Value(1)).current;
  const avatarGlow   = useRef(new Animated.Value(0)).current;
  const avatarPulse  = useRef(new Animated.Value(1)).current;

  const { buttonPress } = useHaptics();

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(avatarPulse, { toValue: 1.06, duration: 950, useNativeDriver: true }),
      Animated.timing(avatarPulse, { toValue: 1.0,  duration: 950, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / (STEPS.length - 1),
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const transitionTo = (next: number) => {
    const dir = next > step ? 1 : -1;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: dir * -28, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(dir * 28);
      setStep(next);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    });
  };

  const onPickAvatar = (emoji: string) => {
    setAvatar(emoji);
    buttonPress();
    Animated.sequence([
      Animated.spring(avatarBounce, { toValue: 1.3, tension: 220, friction: 5, useNativeDriver: true }),
      Animated.spring(avatarBounce, { toValue: 1.0, tension: 220, friction: 5, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(avatarGlow, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(avatarGlow, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  const toggleExam = (id: ExamType) => {
    buttonPress();
    setSelectedExams(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length >= 2;
    if (step === 2) return selectedExams.size > 0;
    if (step === 3) return false;
    return true;
  };

  const handleNext = () => {
    buttonPress();
    if (step === 1 && name.trim().length < 2) { setNameError('Need at least 2 characters.'); return; }
    setNameError('');
    if (step >= STEPS.length - 1) return;
    transitionTo(step + 1);
  };

  const handleFinish = async () => {
    if (selectedExams.size === 0) return;
    const user = {
      name: name.trim(),
      email: '',
      examTypes: Array.from(selectedExams),
      avatar,
      createdAt: new Date().toISOString(),
    };
    await StorageService.saveUser(user);
    const state = await StorageService.getAppState();
    await StorageService.saveAppState({ ...state, user });
    onComplete();
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    buttonPress();
    setGoogleLoading(true);
    try {
      const pending = {
        name: name.trim(),
        avatar,
        examTypes: Array.from(selectedExams),
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem('tint_pending_profile', JSON.stringify(pending));
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'tint://auth/callback' },
      });
    } catch (err) {
      console.error('[Onboarding] Google sign-in error:', err);
      setGoogleLoading(false);
    }
  };

  // ── Renderers ──────────────────────────────────────────
  const renderAvatarStep = () => (
    <View style={stepS.container}>
      <Text style={stepS.stepNum}>01</Text>
      <Text style={stepS.title}>Who are you?</Text>
      <Text style={stepS.sub}>Pick your identity — this is how you appear on TINT.</Text>
      <View style={avatarS.previewArea}>
        <Animated.View style={[avatarS.glowRing, {
          opacity:   avatarGlow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] }),
          transform: [{ scale: avatarGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
        }]} />
        <Animated.View style={[avatarS.previewCircle, {
          transform: [{ scale: Animated.multiply(avatarBounce, avatarPulse) }],
        }]}>
          <Text style={avatarS.previewEmoji}>{avatar}</Text>
        </Animated.View>
      </View>
      <FlatList
        data={AVATARS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={e => e}
        contentContainerStyle={avatarS.carousel}
        renderItem={({ item }) => {
          const selected = avatar === item;
          return (
            <TouchableOpacity
              style={[avatarS.cell, selected && avatarS.cellActive]}
              onPress={() => onPickAvatar(item)}
              activeOpacity={0.7}
            >
              {selected && (
                <LinearGradient
                  colors={[Colors.primary + '55', Colors.primary + '22']}
                  style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.md }]}
                />
              )}
              <Text style={avatarS.cellEmoji}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />
      <Text style={avatarS.hint}>Slide to see more • You can change this anytime</Text>
    </View>
  );

  const renderNameStep = () => (
    <View style={stepS.container}>
      <Text style={stepS.stepNum}>02</Text>
      <View style={stepS.avatarChip}>
        <Text style={{ fontSize: 32 }}>{avatar}</Text>
      </View>
      <Text style={stepS.title}>What's your name?</Text>
      <Text style={stepS.sub}>We'll keep it personal from here on.</Text>
      <TextInput
        style={[stepS.input, nameError ? stepS.inputErr : null]}
        value={name}
        onChangeText={t => { setName(t); setNameError(''); }}
        placeholder="Your name..."
        placeholderTextColor={Colors.textMuted}
        autoFocus
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={handleNext}
      />
      {nameError ? <Text style={stepS.error}>{nameError}</Text> : null}
    </View>
  );

  const renderExamsStep = () => (
    <View style={[stepS.container, { flex: 1 }]}>
      <Text style={stepS.stepNum}>03</Text>
      <Text style={stepS.title}>Which exams are you targeting?</Text>
      <Text style={stepS.sub}>
        Select all that apply — we'll build a combined daily plan tailored to your goals.
      </Text>
      <View style={examS.grid}>
        {EXAM_TYPES.map(exam => {
          const checked = selectedExams.has(exam.id);
          return (
            <TouchableOpacity
              key={exam.id}
              style={[examS.card, checked && { borderColor: exam.color, backgroundColor: exam.color + '14' }]}
              onPress={() => toggleExam(exam.id)}
              activeOpacity={0.75}
            >
              <Text style={examS.emoji}>{exam.emoji}</Text>
              <Text style={[examS.label, checked && { color: exam.color }]}>{exam.label}</Text>
              <Text style={examS.desc}>{exam.description}</Text>
              <View style={[examS.checkbox, checked && { backgroundColor: exam.color, borderColor: exam.color }]}>
                {checked && <Text style={examS.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedExams.size > 1 && (
        <View style={examS.comboNote}>
          <Text style={examS.comboText}>
            🧩 Combined plan: {selectedExams.size} exams detected — we'll merge tasks intelligently.
          </Text>
        </View>
      )}
    </View>
  );

  const renderGoogleStep = () => (
    <View style={[stepS.container, googleS.container]}>
      <Text style={stepS.stepNum}>04</Text>
      <View style={googleS.avatarWrap}>
        <View style={googleS.avatarCircle}>
          <Text style={googleS.avatarEmoji}>{avatar}</Text>
        </View>
      </View>
      <Text style={googleS.nameText}>{name}</Text>
      <View style={googleS.badgeRow}>
        {Array.from(selectedExams).map(exam => {
          const examType = EXAM_TYPES.find(e => e.id === exam);
          if (!examType) return null;
          return (
            <View key={exam} style={[googleS.badge, { backgroundColor: examType.color + '22', borderColor: examType.color + '55' }]}>
              <Text style={[googleS.badgeText, { color: examType.color }]}>{examType.emoji} {examType.label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={googleS.subtitle}>Your progress syncs across all devices</Text>
      <TouchableOpacity
        style={[googleS.googleBtn, googleLoading && { opacity: 0.7 }]}
        onPress={handleGoogleSignIn}
        disabled={googleLoading}
        activeOpacity={0.85}
      >
        {googleLoading ? (
          <ActivityIndicator color="#444" size="small" />
        ) : (
          <>
            <Text style={googleS.googleLogo}>🔵</Text>
            <Text style={googleS.googleText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const CONTENT = [renderAvatarStep, renderNameStep, renderExamsStep, renderGoogleStep];

  const ctaLabel = step === 0 ? `Lock in as ${avatar}  →` : step === 2 ? 'Next →' : 'Continue →';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={['#040010', '#09001A', '#07070E']} style={StyleSheet.absoluteFill} />
        <View style={styles.bgOrb} />
        <View style={styles.header}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]} />
          </View>
          <View style={styles.stepDots}>
            {STEPS.map((label, i) => (
              <View key={i} style={styles.dotWrapper}>
                <View style={[styles.dot, i <= step && styles.dotActive, i === step && styles.dotCurrent]} />
                <Text style={[styles.dotLabel, i <= step && { color: Colors.primaryLight }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
        <Animated.View style={[styles.content, {
          opacity:   fadeAnim,
          transform: [{ translateX: slideAnim }],
        }]}>
          {CONTENT[step]()}
        </Animated.View>
        {step < 3 && (
          <View style={styles.footer}>
            {step > 0 && (
              <TouchableOpacity style={styles.backBtn} onPress={() => { buttonPress(); transitionTo(step - 1); }}>
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
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.nextText, !canProceed() && { color: Colors.textMuted }]}>
                  {ctaLabel}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        {step === 3 && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.backBtn} onPress={() => { buttonPress(); transitionTo(step - 1); }}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const stepS = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: Spacing.sm },
  stepNum: { fontSize: 72, fontWeight: '900', color: Colors.primary + '18', letterSpacing: -3, marginBottom: -Spacing.xl, lineHeight: 80 },
  avatarChip: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.primary + '55', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 16, color: Colors.textPrimary, fontSize: 17, borderWidth: 1.5, borderColor: Colors.border, fontWeight: '500' },
  inputErr: { borderColor: Colors.danger + '88' },
  error: { fontSize: 13, color: Colors.danger, marginTop: -4 },
});

const avatarS = StyleSheet.create({
  previewArea: { alignItems: 'center', justifyContent: 'center', height: 120, marginVertical: Spacing.sm },
  glowRing: { position: 'absolute', width: 116, height: 116, borderRadius: 58, backgroundColor: Colors.primary },
  previewCircle: { width: 92, height: 92, borderRadius: 46, backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.primary + '66', alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 52 },
  carousel: { paddingHorizontal: Spacing.xl, gap: 10, paddingVertical: 4 },
  cell: { width: AVATAR_CELL, height: AVATAR_CELL, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceElevated, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cellActive: { borderColor: Colors.primary },
  cellEmoji: { fontSize: 30 },
  hint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', letterSpacing: 0.4 },
});

const examS = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: (W - Spacing.xl * 2 - 10) / 2,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 4,
    position: 'relative',
  },
  emoji: { fontSize: 28 },
  label: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  desc: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  checkbox: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  comboNote: { backgroundColor: Colors.primary + '18', borderRadius: BorderRadius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.primary + '33' },
  comboText: { fontSize: 13, color: Colors.primaryLight, lineHeight: 20 },
});

const googleS = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.primary + '66', alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 56 },
  nameText: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.md },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  googleLogo: { fontSize: 20 },
  googleText: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', letterSpacing: 0.2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040010' },
  bgOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, top: -100, right: -100, backgroundColor: Colors.primary, opacity: 0.07 },
  header: { paddingTop: 58, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, gap: Spacing.sm },
  progressTrack: { height: 3, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  stepDots: { flexDirection: 'row', justifyContent: 'space-around' },
  dotWrapper: { alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary + '88' },
  dotCurrent: { backgroundColor: Colors.primary, width: 16 },
  dotLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.5 },
  content: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  footer: { flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingBottom: Platform.OS === 'web' ? 32 : 44, paddingTop: Spacing.md, gap: Spacing.sm, alignItems: 'center' },
  backBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  backText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  nextBtn: { flex: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  nextBtnDisabled: { opacity: 0.45 },
  nextGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
});
