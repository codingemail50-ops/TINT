import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { EXAM_TYPES, ExamType, AVATARS, CustomExam } from '../data/examPresets';
import { AvatarWall } from '../components/AvatarWall';
import { CustomExamModal } from '../components/CustomExamModal';
import { useHaptics } from '../hooks/useHaptics';

const { width: W } = Dimensions.get('window');
const WALL_HEIGHT = 260;

interface Props {
  onComplete: (data: { avatar: string; examTypes: ExamType[]; customExam?: CustomExam }) => void;
  onLogin: () => void;
  /** Only set when this step was opened as a replay (e.g. the Home wordmark
   *  shortcut) — a real first launch has nowhere to go back to. */
  onBack?: () => void;
}

// Screen 1 of onboarding — a continuously-scrolling wall of pixel-icon
// avatars at a slight angle (tap one to pick it, same procedural icon set as
// the rest of the app) and which exam(s) to prep for, in one screen instead
// of two separate steps.
export const AvatarExamScreen: React.FC<Props> = ({ onComplete, onLogin, onBack }) => {
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [selectedExams, setSelectedExams] = useState<Set<ExamType>>(new Set());
  const [customExam, setCustomExam] = useState<CustomExam | null>(null);
  const [customExamModalOpen, setCustomExamModalOpen] = useState(false);
  const examPunch = useRef(EXAM_TYPES.map(() => new Animated.Value(1))).current;

  const { buttonPress, dialTick } = useHaptics();

  const onPickAvatar = (icon: string) => {
    if (icon === avatar) return;
    setAvatar(icon);
    void dialTick();
  };

  const toggleExam = (id: ExamType, index: number) => {
    buttonPress();
    setSelectedExams(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    // A snappy scale-punch stands in for a "pixel transform" flourish on the
    // color swap — cheap, native-driven, and reads as a quick chunky flip
    // rather than a smooth fade.
    Animated.sequence([
      Animated.timing(examPunch[index], { toValue: 0.85, duration: 60, useNativeDriver: true }),
      Animated.spring(examPunch[index], { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();
  };

  const canProceed = selectedExams.size > 0 || !!customExam;

  const handleOther = () => {
    buttonPress();
    setCustomExamModalOpen(true);
  };

  const handleSaveCustomExam = (exam: CustomExam) => {
    setCustomExam(exam);
    setCustomExamModalOpen(false);
  };

  const handleContinue = () => {
    if (!canProceed) return;
    buttonPress();
    onComplete({ avatar, examTypes: Array.from(selectedExams), customExam: customExam ?? undefined });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}

      {/* Solid header, entirely above the wall — kept separate on purpose so
          the heading never sits on top of the moving icons. */}
      <View style={styles.header}>
        <Text style={styles.pixelTitle}>Choose Your Avatar</Text>
        <Text style={styles.sub}>Tap an avatar in the wall to pick it.</Text>
      </View>

      <View style={styles.wallSection}>
        <AvatarWall icons={AVATARS} selected={avatar} onPick={onPickAvatar} rows={6} cellSize={56} angleDeg={-7} />
        <LinearGradient
          colors={['rgba(6,6,8,0.9)', 'rgba(6,6,8,0)', 'rgba(6,6,8,0.9)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={examS.sectionLabel}>What's Your Exam?</Text>
        <TouchableOpacity
          style={[examS.otherBtn, !!customExam && examS.otherBtnActive]}
          onPress={handleOther}
          activeOpacity={0.75}
        >
          <Text style={[examS.otherText, !!customExam && examS.otherTextActive]} numberOfLines={1}>
            {customExam ? `✓ ${customExam.name}` : 'Other'}
          </Text>
        </TouchableOpacity>
        <View style={examS.grid}>
          {EXAM_TYPES.map((exam, index) => {
            const checked = selectedExams.has(exam.id);
            return (
              <Animated.View key={exam.id} style={{ transform: [{ scale: examPunch[index] }], width: (W - Spacing.xl * 2 - 10) / 2 }}>
                <TouchableOpacity
                  style={[examS.card, checked && examS.cardActive]}
                  onPress={() => toggleExam(exam.id, index)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={exam.icon as any} size={24} color={checked ? '#000' : Colors.textSecondary} />
                  <Text style={[examS.label, checked && examS.labelActive]}>{exam.label}</Text>
                  <View style={[examS.checkbox, checked && examS.checkboxActive]}>
                    {checked && <Text style={examS.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
        {selectedExams.size > 1 && (
          <View style={examS.comboNote}>
            <Text style={examS.comboText}>
              Combined plan: {selectedExams.size} exams detected — we'll merge tasks intelligently.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
          onPress={handleContinue}
          disabled={!canProceed}
          activeOpacity={0.85}
        >
          <View style={[styles.nextGradient, { backgroundColor: canProceed ? Colors.pop : Colors.surfaceElevated }]}>
            <Text style={[styles.nextText, !canProceed && { color: Colors.textMuted }]}>Continue →</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogin} activeOpacity={0.7}>
          <Text style={styles.loginLink}>Already have an account? <Text style={styles.loginLinkStrong}>Log in</Text></Text>
        </TouchableOpacity>
      </View>

      <CustomExamModal
        visible={customExamModalOpen}
        initial={customExam}
        onClose={() => setCustomExamModalOpen(false)}
        onSave={handleSaveCustomExam}
      />
    </View>
  );
};

const examS = StyleSheet.create({
  sectionLabel: { fontFamily: Fonts.pixel, fontSize: 26, color: Colors.textPrimary, letterSpacing: 0.5, marginBottom: Spacing.sm },
  otherBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  otherText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textSecondary },
  otherBtnActive: { backgroundColor: Colors.pop, borderColor: Colors.pop },
  otherTextActive: { color: '#000' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 4,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardActive: { borderColor: Colors.pop, backgroundColor: Colors.pop },
  label: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, marginLeft: 8, flex: 1 },
  labelActive: { color: '#000' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#000', borderColor: '#000' },
  checkmark: { color: Colors.pop, fontSize: 12, fontFamily: Fonts.bold },
  comboNote: { backgroundColor: Colors.popGlow, borderRadius: BorderRadius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.pop + '33', marginTop: Spacing.sm },
  comboText: { fontSize: 13, color: Colors.popLight, lineHeight: 20, fontFamily: Fonts.regular },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backBtn: { position: 'absolute', top: 58, left: Spacing.xl, zIndex: 2 },
  backText: { fontSize: 15, color: Colors.textPrimary, fontFamily: Fonts.medium },
  header: { paddingTop: 100, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, backgroundColor: Colors.background },
  pixelTitle: { fontFamily: Fonts.pixel, fontSize: 34, color: Colors.textPrimary, letterSpacing: 0.5, marginBottom: 4 },
  wallSection: { height: WALL_HEIGHT, overflow: 'hidden', backgroundColor: Colors.background },
  sub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, fontFamily: Fonts.regular },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.sm },
  nextBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  nextBtnDisabled: { opacity: 0.45 },
  nextGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 17, fontFamily: Fonts.bold, color: '#000', letterSpacing: 0.2 },
  loginLink: { textAlign: 'center', fontSize: 13, color: Colors.textSecondary, fontFamily: Fonts.regular },
  loginLinkStrong: { color: Colors.pop, fontFamily: Fonts.semibold },
});
