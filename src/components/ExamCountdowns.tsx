import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';

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
  target: Date;
}

const CountdownCard: React.FC<CountdownCardProps> = ({ examName, target }) => {
  const [remaining, setRemaining] = useState<RemainingTime>(() => getRemaining(target));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining.passed) {
    return (
      <View style={[styles.card, { borderColor: Colors.success }]}>
        <Text style={styles.passedText}>Exam day is here!</Text>
        <Text style={styles.examLabel}>{examName}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.examLabel}>{examName} Countdown</Text>
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
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray[800],
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  examLabel: {
    ...Typography.labelSmall, fontFamily: Fonts.bold, color: Colors.gray[300],
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  countdownText: { fontFamily: Fonts.pixel, fontSize: 32, color: Colors.textPrimary, letterSpacing: 0 },
  dateStamp: { ...Typography.bodySmall, color: Colors.textMuted },
  passedText: { ...Typography.headlineSmall, color: Colors.success },
});

interface CountdownProps {
  examTypes: string[];
}

export const UCEEDCountdown: React.FC<CountdownProps> = ({ examTypes }) => {
  if (!examTypes.includes('UCEED')) return null;
  return <CountdownCard examName="UCEED" target={new Date('2027-01-17T09:00:00+05:30')} />;
};

export const NIDCountdown: React.FC<CountdownProps> = ({ examTypes }) => {
  if (!examTypes.includes('NID')) return null;
  return <CountdownCard examName="NID" target={new Date('2026-12-21T09:00:00+05:30')} />;
};

export const NIFTCountdown: React.FC<CountdownProps> = ({ examTypes }) => {
  if (!examTypes.includes('NIFT')) return null;
  return <CountdownCard examName="NIFT" target={new Date('2027-02-08T09:00:00+05:30')} />;
};
