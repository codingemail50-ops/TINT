import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDateStamp(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()} / ${d.getFullYear()}`;
}

interface CountdownCardProps {
  examName: string;
  emoji: string;
  accentColor: string;
  target: Date;
}

const CountdownCard: React.FC<CountdownCardProps> = ({ examName, emoji, accentColor, target }) => {
  const [remaining, setRemaining] = useState<RemainingTime>(() => getRemaining(target));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining.passed) {
    return (
      <View style={[styles.card, { borderColor: Colors.success }]}>
        <Text style={styles.passedText}>🎉 Exam day is here!</Text>
        <Text style={[styles.examLabel, { color: accentColor }]}>{examName}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: accentColor + '55' }]}>
      <View style={styles.headerRow}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.examLabel, { color: accentColor }]}>{examName} Countdown</Text>
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.countdownText}>
          {remaining.days}d  {pad(remaining.hours)}:{pad(remaining.mins)}:{pad(remaining.secs)}
        </Text>
        <Text style={styles.dateStamp}>{formatDateStamp(target)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 6 },
  emoji: { fontSize: 16 },
  examLabel: { ...Typography.labelSmall, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countdownText: { ...Typography.headlineMedium, color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  dateStamp: { ...Typography.bodySmall, color: Colors.textMuted },
  passedText: { ...Typography.headlineSmall, color: Colors.success },
});

interface CountdownProps {
  examTypes: string[];
}

export const UCEEDCountdown: React.FC<CountdownProps> = ({ examTypes }) => {
  if (!examTypes.includes('UCEED')) return null;
  return (
    <CountdownCard
      examName="UCEED"
      emoji="⏳"
      accentColor="#FB923C"
      target={new Date('2027-01-17T09:00:00+05:30')}
    />
  );
};

export const NIDCountdown: React.FC<CountdownProps> = ({ examTypes }) => {
  if (!examTypes.includes('NID')) return null;
  return (
    <CountdownCard
      examName="NID"
      emoji="🎨"
      accentColor="#EC4899"
      target={new Date('2026-12-21T09:00:00+05:30')}
    />
  );
};

export const NIFTCountdown: React.FC<CountdownProps> = ({ examTypes }) => {
  if (!examTypes.includes('NIFT')) return null;
  return (
    <CountdownCard
      examName="NIFT"
      emoji="👗"
      accentColor="#F59E0B"
      target={new Date('2027-02-08T09:00:00+05:30')}
    />
  );
};
