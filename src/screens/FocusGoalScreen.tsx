import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { BlobDial } from '../components/BlobDial';
import { PixelFlame } from '../components/PixelFlame';
import { MeditatingFlame } from '../components/MeditatingFlame';
import { useHaptics } from '../hooks/useHaptics';

const MIN_MINS = 15;
const MAX_MINS = 180;
const STEP_MINS = 5;
const DEFAULT_MINS = 60;

function formatGoal(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface Props {
  initialMins?: number;
  onComplete: (dailyFocusGoalMins: number) => void;
  onBack?: () => void;
}

// Screen 3 of onboarding (also reused from the Profile screen to change the
// goal later) — the same squiggly-blob shape as the Focus timer, grey,
// dragged to set the daily goal.
export const FocusGoalScreen: React.FC<Props> = ({ initialMins = DEFAULT_MINS, onComplete, onBack }) => {
  const [mins, setMins] = useState(initialMins);
  const { buttonPress } = useHaptics();

  const handleContinue = () => {
    buttonPress();
    onComplete(mins);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}
      <View style={styles.header}>
        <View style={styles.goalPill}>
          <Text style={styles.goalPillText}>Set Goal</Text>
        </View>
        <Text style={styles.sub}>You can always change it later.</Text>
      </View>

      <View style={styles.dialWrap}>
        <MeditatingFlame size={100} style={styles.mascot} />
        <BlobDial
          size={260}
          minValue={MIN_MINS}
          maxValue={MAX_MINS}
          step={STEP_MINS}
          value={mins}
          onChange={setMins}
          formatValue={formatGoal}
          unitLabel="per day"
        />

        <View style={styles.labelsRow}>
          <Text style={[styles.pixelLabel, { color: Colors.textPrimary }]}>Goal</Text>
          <Text style={[styles.pixelLabel, { color: Colors.pop }]}>Focus</Text>
        </View>
        <View style={styles.dailyRow}>
          <PixelFlame size={22} state="static" intensity="pop" />
          <Text style={[styles.pixelLabel, { color: Colors.textPrimary }]}>Daily</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleContinue} activeOpacity={0.85}>
          <View style={styles.nextGradient}>
            <Text style={styles.nextText}>Continue →</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backBtn: { position: 'absolute', top: 58, left: Spacing.xl, zIndex: 1 },
  backText: { fontSize: 15, color: Colors.textSecondary, fontFamily: Fonts.medium },
  header: { paddingTop: 100, paddingHorizontal: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  goalPill: {
    backgroundColor: Colors.pop,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 10,
  },
  goalPillText: { fontSize: 15, fontFamily: Fonts.bold, color: '#000', letterSpacing: 0.5, textTransform: 'uppercase' },
  sub: { fontSize: 13, color: Colors.textSecondary, fontFamily: Fonts.regular },
  dialWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  mascot: { marginBottom: Spacing.sm },
  labelsRow: { flexDirection: 'row', gap: Spacing.lg },
  dailyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  pixelLabel: { fontFamily: Fonts.pixel, fontSize: 26, letterSpacing: 1, textTransform: 'uppercase' },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, paddingTop: Spacing.sm },
  nextBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  nextGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.pop },
  nextText: { fontSize: 17, fontFamily: Fonts.bold, color: '#000', letterSpacing: 0.2 },
});
