import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { KnurledDial } from '../components/KnurledDial';
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

// Screen 2 of onboarding (also reused from the Profile screen to change the
// goal later) — a rotary dial styled like a hardware macro-pad/volume knob.
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
        <Text style={styles.stepNum}>02</Text>
        <Text style={styles.title}>Set your daily focus goal</Text>
        <Text style={styles.sub}>Turn the dial — you can always change this later.</Text>
      </View>

      <View style={styles.dialWrap}>
        <KnurledDial
          size={260}
          minValue={MIN_MINS}
          maxValue={MAX_MINS}
          step={STEP_MINS}
          value={mins}
          onChange={setMins}
          formatValue={formatGoal}
          unitLabel="per day"
        />
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
  header: { paddingTop: 100, paddingHorizontal: Spacing.xl },
  stepNum: { fontSize: 56, fontFamily: Fonts.bold, color: Colors.primary + '18', letterSpacing: -3, marginBottom: -Spacing.lg, lineHeight: 64 },
  title: { fontSize: 26, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, fontFamily: Fonts.regular },
  dialWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, paddingTop: Spacing.sm },
  nextBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  nextGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  nextText: { fontSize: 17, fontFamily: Fonts.bold, color: '#000', letterSpacing: 0.2 },
});
