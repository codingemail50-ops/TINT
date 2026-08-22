import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, FlatList, Dimensions, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { EXAM_TYPES, ExamType, AVATARS } from '../data/examPresets';
import { PixelIcon } from '../components/PixelIcon';
import { useHaptics } from '../hooks/useHaptics';

const { width: W } = Dimensions.get('window');
const AVATAR_CELL = 72;

interface Props {
  onComplete: (data: { avatar: string; examTypes: ExamType[] }) => void;
  onLogin: () => void;
  /** Only set when this step was opened as a replay (e.g. the Home wordmark
   *  shortcut) — a real first launch has nowhere to go back to. */
  onBack?: () => void;
}

// Screen 1 of onboarding — pick a pixel-art avatar (procedurally drawn, same
// technique as the flame, full color — the one deliberate break from the
// app's greyscale/orange theme) and which exam(s) to prep for, in one
// screen instead of two separate steps.
export const AvatarExamScreen: React.FC<Props> = ({ onComplete, onLogin, onBack }) => {
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [selectedExams, setSelectedExams] = useState<Set<ExamType>>(new Set());

  const avatarBounce = useRef(new Animated.Value(1)).current;
  const avatarGlow = useRef(new Animated.Value(0)).current;
  const avatarPulse = useRef(new Animated.Value(1)).current;

  const { buttonPress } = useHaptics();

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(avatarPulse, { toValue: 1.06, duration: 950, useNativeDriver: true }),
      Animated.timing(avatarPulse, { toValue: 1.0, duration: 950, useNativeDriver: true }),
    ])).start();
  }, []);

  const onPickAvatar = (icon: string) => {
    setAvatar(icon);
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

  const canProceed = selectedExams.size > 0;

  const handleContinue = () => {
    if (!canProceed) return;
    buttonPress();
    onComplete({ avatar, examTypes: Array.from(selectedExams) });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.bgOrb} />
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepNum}>01</Text>
        <Text style={styles.title}>Who are you, and what are you here for?</Text>
        <Text style={styles.sub}>Pick your look and the exam(s) you're prepping for.</Text>

        <View style={avatarS.previewArea}>
          <Animated.View style={[avatarS.glowRing, {
            opacity: avatarGlow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] }),
            transform: [{ scale: avatarGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
          }]} />
          <Animated.View style={[avatarS.previewCircle, {
            transform: [{ scale: Animated.multiply(avatarBounce, avatarPulse) }],
          }]}>
            <PixelIcon name={avatar} size={52} />
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
                <PixelIcon name={item} size={34} />
              </TouchableOpacity>
            );
          }}
        />
        <Text style={avatarS.hint}>Slide to see more • You can change this anytime</Text>

        <Text style={examS.sectionLabel}>Which exams are you targeting?</Text>
        <View style={examS.grid}>
          {EXAM_TYPES.map(exam => {
            const checked = selectedExams.has(exam.id);
            return (
              <TouchableOpacity
                key={exam.id}
                style={[examS.card, checked && examS.cardActive]}
                onPress={() => toggleExam(exam.id)}
                activeOpacity={0.75}
              >
                <Ionicons name={exam.icon as any} size={24} color={checked ? Colors.primary : Colors.textSecondary} />
                <Text style={[examS.label, checked && examS.labelActive]}>{exam.label}</Text>
                <View style={[examS.checkbox, checked && examS.checkboxActive]}>
                  {checked && <Text style={examS.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
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
          <View style={[styles.nextGradient, { backgroundColor: canProceed ? Colors.primary : Colors.surfaceElevated }]}>
            <Text style={[styles.nextText, !canProceed && { color: Colors.textMuted }]}>Continue →</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogin} activeOpacity={0.7}>
          <Text style={styles.loginLink}>Already have an account? <Text style={styles.loginLinkStrong}>Log in</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const avatarS = StyleSheet.create({
  previewArea: { alignItems: 'center', justifyContent: 'center', height: 110, marginVertical: Spacing.sm },
  glowRing: { position: 'absolute', width: 106, height: 106, borderRadius: 53, backgroundColor: Colors.primary },
  previewCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.primary + '66', alignItems: 'center', justifyContent: 'center' },
  carousel: { gap: 10, paddingVertical: 4 },
  cell: { width: AVATAR_CELL, height: AVATAR_CELL, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceElevated, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cellActive: { borderColor: Colors.primary },
  hint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', letterSpacing: 0.4, fontFamily: Fonts.regular, marginBottom: Spacing.lg },
});

const examS = StyleSheet.create({
  sectionLabel: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  label: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, marginLeft: 8, flex: 1 },
  labelActive: { color: Colors.primary },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#000', fontSize: 12, fontFamily: Fonts.bold },
  comboNote: { backgroundColor: Colors.primary + '18', borderRadius: BorderRadius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.primary + '33', marginTop: Spacing.sm },
  comboText: { fontSize: 13, color: Colors.primaryLight, lineHeight: 20, fontFamily: Fonts.regular },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, top: -100, right: -100, backgroundColor: Colors.primary, opacity: 0.07 },
  backBtn: { position: 'absolute', top: 58, left: Spacing.xl, zIndex: 1 },
  backText: { fontSize: 15, color: Colors.textSecondary, fontFamily: Fonts.medium },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: 100, paddingBottom: Spacing.xl },
  stepNum: { fontSize: 56, fontFamily: Fonts.bold, color: Colors.primary + '18', letterSpacing: -3, marginBottom: -Spacing.lg, lineHeight: 64 },
  title: { fontSize: 26, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.sm, fontFamily: Fonts.regular },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.sm },
  nextBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  nextBtnDisabled: { opacity: 0.45 },
  nextGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 17, fontFamily: Fonts.bold, color: '#000', letterSpacing: 0.2 },
  loginLink: { textAlign: 'center', fontSize: 13, color: Colors.textSecondary, fontFamily: Fonts.regular },
  loginLinkStrong: { color: Colors.primary, fontFamily: Fonts.semibold },
});
