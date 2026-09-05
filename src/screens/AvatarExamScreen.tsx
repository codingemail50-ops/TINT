import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { EXAM_TYPES, ExamType, AVATARS, CustomExam } from '../data/examPresets';
import { AvatarWall } from '../components/AvatarWall';
import { PixelIcon } from '../components/PixelIcon';
import { CustomExamModal } from '../components/CustomExamModal';
import { useHaptics } from '../hooks/useHaptics';

const { width: W } = Dimensions.get('window');
const WALL_HEIGHT = 260;

interface Props {
  onComplete: (data: { avatar: string; examTypes: ExamType[]; customExam?: CustomExam }) => void;
  onLogin: () => void;
}

// Screen 1 of onboarding — a continuously-scrolling wall of pixel-icon
// avatars at a slight angle (tap one to pick it, same procedural icon set as
// the rest of the app) and which exam(s) to prep for, in one screen instead
// of two separate steps.
export const AvatarExamScreen: React.FC<Props> = ({ onComplete, onLogin }) => {
  const [avatar, setAvatar] = useState(AVATARS[0]);
  // Wall is only shown while actively picking — once you tap one, it locks
  // in and the wall stops animating/mounting entirely (both for a calmer
  // "confirmed" feel and because it's the single biggest perf cost on this
  // screen). "Change avatar" reopens the wall to pick again.
  const [picking, setPicking] = useState(true);
  const [selectedExams, setSelectedExams] = useState<Set<ExamType>>(new Set());
  const [customExam, setCustomExam] = useState<CustomExam | null>(null);
  const [customExamModalOpen, setCustomExamModalOpen] = useState(false);
  const examPunch = useRef(EXAM_TYPES.map(() => new Animated.Value(1))).current;

  const { buttonPress, dialTick } = useHaptics();

  // useHaptics() returns a fresh function object every render, so reading
  // dialTick through a ref (instead of closing over it directly) is what
  // lets this callback keep ONE stable identity across renders — required
  // for AvatarWall's React.memo to actually skip re-rendering the wall
  // when unrelated state on this screen changes (e.g. an exam toggle).
  const dialTickRef = useRef(dialTick);
  dialTickRef.current = dialTick;

  const onPickAvatar = useCallback((icon: string) => {
    setAvatar(icon);
    setPicking(false);
    void dialTickRef.current();
  }, []);

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

  const avatarLabel = avatar.charAt(0).toUpperCase() + avatar.slice(1);
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

      {/* Solid header, entirely above the wall — kept separate on purpose so
          the heading never sits on top of the moving icons. */}
      <View style={styles.header}>
        <Text style={styles.pixelTitle}>Choose Your Avatar</Text>
        {picking && <Text style={styles.sub}>Tap an avatar in the wall to pick it.</Text>}
      </View>

      {/* Always mounted (never conditionally rendered) — toggling `active`
          just pauses the scroll loop instead of tearing down and re-creating
          every cell, which is what made reopening the wall feel laggy. The
          "picked" state overlays on top rather than replacing this section. */}
      <View style={styles.wallSection}>
        <AvatarWall icons={AVATARS} selected={avatar} onPick={onPickAvatar} rows={6} cellSize={56} angleDeg={-7} durationMs={22000} active={picking} />
        {picking ? (
          <LinearGradient
            colors={['rgba(6,6,8,0.9)', 'rgba(6,6,8,0)', 'rgba(6,6,8,0.9)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.pickedSection, { backgroundColor: Colors.background }]}>
            <View style={styles.pickedAvatarCircle}>
              <PixelIcon name={avatar} size={72} />
            </View>
            <Text style={styles.pickedName}>{avatarLabel}</Text>
            <TouchableOpacity style={styles.changeAvatarBtn} onPress={() => setPicking(true)} activeOpacity={0.75}>
              <Text style={styles.changeAvatarText}>Change avatar</Text>
            </TouchableOpacity>
          </View>
        )}
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
  label: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, flex: 1 },
  labelActive: { color: '#000' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#000', borderColor: '#000' },
  checkmark: { color: Colors.pop, fontSize: 12, fontFamily: Fonts.bold },
  comboNote: { backgroundColor: Colors.popGlow, borderRadius: BorderRadius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.pop + '33', marginTop: Spacing.sm },
  comboText: { fontSize: 13, color: Colors.popLight, lineHeight: 20, fontFamily: Fonts.regular },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 100, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, backgroundColor: Colors.background },
  pixelTitle: { fontFamily: Fonts.pixel, fontSize: 34, color: Colors.textPrimary, letterSpacing: 0.5, marginBottom: 4 },
  wallSection: { height: WALL_HEIGHT, overflow: 'hidden', backgroundColor: Colors.background },
  sub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, fontFamily: Fonts.regular, flexShrink: 1 },
  pickedSection: { height: WALL_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  pickedAvatarCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.pop,
    alignItems: 'center', justifyContent: 'center',
  },
  pickedName: { fontFamily: Fonts.pixel, fontSize: 22, color: Colors.textPrimary, letterSpacing: 0.5 },
  changeAvatarBtn: {
    borderRadius: BorderRadius.full, borderWidth: 2, borderColor: Colors.border,
    paddingVertical: 8, paddingHorizontal: 18, marginTop: 4,
  },
  changeAvatarText: { fontSize: 13, fontFamily: Fonts.semibold, color: Colors.pop },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.sm },
  nextBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  nextBtnDisabled: { opacity: 0.45 },
  nextGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 17, fontFamily: Fonts.bold, color: '#000', letterSpacing: 0.2 },
  loginLink: { textAlign: 'center', fontSize: 13, color: Colors.textSecondary, fontFamily: Fonts.regular },
  loginLinkStrong: { color: Colors.pop, fontFamily: Fonts.semibold },
});
