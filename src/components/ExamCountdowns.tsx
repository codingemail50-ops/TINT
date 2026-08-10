import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';

interface RemainingTime {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  passed: boolean;
}

function getRemaining(target: Date): RemainingTime {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, passed: true };

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return { days, hours, mins, secs, passed: false };
}

interface ExamDef {
  id: string;
  examName: string;
  icon: keyof typeof Ionicons.glyphMap;
  target: Date;
}

const EXAM_DEFS: ExamDef[] = [
  { id: 'UCEED', examName: 'UCEED', icon: 'pencil',        target: new Date('2027-01-17T09:00:00+05:30') },
  { id: 'NID',   examName: 'NID',   icon: 'color-palette', target: new Date('2026-12-21T09:00:00+05:30') },
  { id: 'NIFT',  examName: 'NIFT',  icon: 'shirt',         target: new Date('2027-02-08T09:00:00+05:30') },
];

// Compact single-line countdown chip — used in a horizontal strip so multiple
// exams don't eat a full screen's worth of vertical space.
const CountdownChip: React.FC<ExamDef> = ({ examName, icon, target }) => {
  const [remaining, setRemaining] = useState<RemainingTime>(() => getRemaining(target));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining.passed) {
    return (
      <View style={[styles.chip, { borderColor: Colors.success }]}>
        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
        <Text style={styles.passedText}>{examName} day is here!</Text>
      </View>
    );
  }

  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={13} color={Colors.textSecondary} />
      <Text style={styles.examLabel}>{examName}</Text>
      <Text style={styles.countdownText}>{remaining.days}d {remaining.hours}h</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  examLabel: { ...Typography.labelSmall, fontWeight: '700', color: Colors.textSecondary, fontSize: 11 },
  countdownText: { ...Typography.labelSmall, color: Colors.textPrimary, fontWeight: '700', fontVariant: ['tabular-nums'] },
  passedText: { ...Typography.labelSmall, color: Colors.success, fontWeight: '700' },
});

interface StripProps {
  examTypes: string[];
}

// Renders one compact chip per exam the user is preparing for, in a single
// horizontally-scrollable row.
export const ExamCountdownStrip: React.FC<StripProps> = ({ examTypes }) => {
  const active = EXAM_DEFS.filter(e => examTypes.includes(e.id));
  if (active.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={stripSt.row}
    >
      {active.map(def => <CountdownChip key={def.id} {...def} />)}
    </ScrollView>
  );
};

const stripSt = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
});
