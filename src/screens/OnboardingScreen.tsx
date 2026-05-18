import React, { useState, useRef } from 'react';
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

const { height: H } = Dimensions.get('window');

interface Props {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(0); // 0: welcome, 1: name, 2: email, 3: exam
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedExam, setSelectedExam] = useState<ExamType | null>(null);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { buttonPress } = useHaptics();

  const transitionStep = (nextStep: number) => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -30, duration: 200, useNativeDriver: true }),
      ]),
    ]).start(() => {
      slideAnim.setValue(30);
      setStep(nextStep);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    buttonPress();
    if (step === 1) {
      if (name.trim().length < 2) {
        setNameError('Enter your name — it personalizes your journey.');
        return;
      }
      setNameError('');
    }
    if (step === 2) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailError('Enter a valid email to back up your data.');
        return;
      }
      setEmailError('');
    }
    if (step === 3) {
      handleFinish();
      return;
    }
    transitionStep(step + 1);
  };

  const handleFinish = async () => {
    if (!selectedExam) return;
    await StorageService.saveUser({
      name: name.trim(),
      email: email.trim(),
      examType: selectedExam,
      createdAt: new Date().toISOString(),
    });
    const state = await StorageService.getAppState();
    await StorageService.saveAppState({ ...state, user: { name: name.trim(), email: email.trim(), examType: selectedExam, createdAt: new Date().toISOString() } });
    onComplete();
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.welcomeEmoji}>🔥</Text>
          <Text style={styles.displayTitle}>Ready to outwork everyone?</Text>
          <Text style={styles.displaySub}>
            TINT helps you lock in every day, track your consistency, and show you exactly where you stand.
          </Text>
          <Text style={styles.displaySub2}>No fluff. No excuses. Just work.</Text>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepNumber}>01</Text>
          <Text style={styles.stepTitle}>What's your name?</Text>
          <Text style={styles.stepSub}>This will personalize your experience.</Text>
          <TextInput
            style={[styles.input, nameError ? styles.inputError : null]}
            value={name}
            onChangeText={t => { setName(t); setNameError(''); }}
            placeholder="Your name..."
            placeholderTextColor={Colors.textMuted}
            autoFocus
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={handleNext}
          />
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepNumber}>02</Text>
          <Text style={styles.stepTitle}>Back up your data</Text>
          <Text style={styles.stepSub}>Optional — your email is only used for backup.</Text>
          <TextInput
            style={[styles.input, emailError ? styles.inputError : null]}
            value={email}
            onChangeText={t => { setEmail(t); setEmailError(''); }}
            placeholder="your@email.com (optional)"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
            returnKeyType="next"
            onSubmitEditing={handleNext}
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepNumber}>03</Text>
          <Text style={styles.stepTitle}>What exam are you targeting?</Text>
          <Text style={styles.stepSub}>We'll preload your daily tasks based on your goal.</Text>
          <ScrollView style={styles.examList} showsVerticalScrollIndicator={false}>
            {EXAM_TYPES.map(exam => (
              <TouchableOpacity
                key={exam.id}
                style={[styles.examCard, selectedExam === exam.id && styles.examCardSelected]}
                onPress={() => { setSelectedExam(exam.id); buttonPress(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.examEmoji}>{exam.emoji}</Text>
                <View style={styles.examInfo}>
                  <Text style={[styles.examLabel, selectedExam === exam.id && { color: Colors.primary }]}>
                    {exam.label}
                  </Text>
                  <Text style={styles.examDesc}>{exam.description}</Text>
                </View>
                {selectedExam === exam.id && (
                  <View style={styles.selectedCheck}>
                    <Text style={styles.selectedCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }

    return null;
  };

  const canProceed = () => {
    if (step === 3) return selectedExam !== null;
    return true;
  };

  const STEP_LABELS = ['Welcome', 'Name', 'Email', 'Exam'];
  const progressWidth = `${((step) / 3) * 100}%` as any;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0A0015', '#080810']} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <View style={styles.stepIndicators}>
            {STEP_LABELS.map((label, i) => (
              <Text key={i} style={[styles.stepIndicator, i <= step && { color: Colors.primaryLight }]}>
                {label}
              </Text>
            ))}
          </View>
        </View>

        {/* Content */}
        <Animated.View
          style={[
            styles.contentWrapper,
            {
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {renderStep()}
        </Animated.View>

        {/* Footer CTA */}
        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => { buttonPress(); transitionStep(step - 1); }}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canProceed()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={canProceed() ? ['#9B5CF6', '#7C3AED'] : [Colors.surfaceElevated, Colors.surfaceElevated]}
              style={styles.nextBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.nextText, !canProceed() && { color: Colors.textMuted }]}>
                {step === 0 ? "Let's go →" : step === 3 ? "Start grinding →" : "Continue →"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
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
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepIndicator: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontSize: 10,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  welcomeEmoji: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  displayTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  displaySub: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  displaySub2: {
    ...Typography.bodyMedium,
    color: Colors.primary,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 1,
  },
  stepNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: Colors.primary + '22',
    letterSpacing: -2,
    marginBottom: -Spacing.xl,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  stepSub: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 17,
    borderWidth: 1.5,
    borderColor: Colors.border,
    fontWeight: '500',
  },
  inputError: {
    borderColor: Colors.danger + '88',
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.danger,
    marginTop: -Spacing.sm,
  },
  examList: {
    flex: 1,
    marginTop: Spacing.sm,
  },
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  examCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  examEmoji: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  examInfo: {
    flex: 1,
    gap: 3,
  },
  examLabel: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
  },
  examDesc: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  selectedCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  backBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  nextBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnGradient: {
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    ...Typography.headlineSmall,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
