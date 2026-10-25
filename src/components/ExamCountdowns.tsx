import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { eventsFor, ExamEvent } from '../data/examDates';

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

interface CountdownCardProps {
  event: ExamEvent;
}

const CountdownCard: React.FC<CountdownCardProps> = ({ event }) => {
  const target = event.start!;
  const [remaining, setRemaining] = useState<RemainingTime>(() => getRemaining(target));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining.passed) {
    return (
      <View style={[styles.card, { borderColor: Colors.success }]}>
        <Text style={styles.passedText}>Exam day is here!</Text>
        <Text style={styles.examLabel}>{event.label}</Text>
        <Text style={styles.dateStamp}>{event.dateText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.examLabel}>{event.label}</Text>
      <Text style={styles.countdownText}>
        {remaining.days}d  {pad(remaining.hours)}:{pad(remaining.mins)}:{pad(remaining.secs)}
      </Text>
      <Text style={styles.dateStamp}>{event.dateText}</Text>
    </View>
  );
};

// An exam whose date has not been published yet.
const PendingCard: React.FC<CountdownCardProps> = ({ event }) => (
  <View style={styles.card}>
    <Text style={styles.examLabel}>{event.label}</Text>
    <Text style={styles.pendingText}>{event.dateText}</Text>
  </View>
);

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
  countdownText: { fontFamily: Fonts.pixel, fontSize: 32, color: Colors.textPrimary, letterSpacing: 0 },
  dateStamp: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  pendingText: { ...Typography.bodyMedium, color: Colors.textSecondary },
  passedText: { ...Typography.headlineSmall, color: Colors.success },
});

interface CountdownProps {
  examTypes: string[];
}

/** One card per exam the person picked: a live countdown when the date is
 *  known, "Not announced" until it is. Dates live in data/examDates.ts. */
export const ExamCountdowns: React.FC<CountdownProps> = ({ examTypes }) => (
  <>
    {eventsFor(examTypes).map(e => (e.start ? <CountdownCard key={e.id} event={e} /> : <PendingCard key={e.id} event={e} />))}
  </>
);
