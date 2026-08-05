import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { AppState } from '../utils/storage';
import { ExamType } from '../data/examPresets';

// Same condensed poster face used on the loading/hero moments elsewhere.
const DISPLAY_FONT = Platform.OS === 'web'
  ? 'Impact, "Arial Narrow Bold", "Arial Black", sans-serif'
  : undefined;

// Only exams with a real published date get a countdown — no invented dates.
const EXAM_DATES: Partial<Record<ExamType, Date>> = {
  UCEED: new Date('2027-01-17T09:00:00+05:30'),
  NID: new Date('2026-12-21T09:00:00+05:30'),
  NIFT: new Date('2027-02-08T09:00:00+05:30'),
};

function daysUntil(d: Date): number {
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

interface Props { appState: AppState }

export const HomeScreen: React.FC<Props> = ({ appState }) => {
  const [showProfile, setShowProfile] = useState(false);
  const user = appState.user;
  const examTypes = (user?.examTypes ?? []) as ExamType[];

  const nearest = examTypes
    .map(exam => ({ exam, date: EXAM_DATES[exam] }))
    .filter((x): x is { exam: ExamType; date: Date } => !!x.date)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  const dateLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.topRow}>
          <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfile(true)} activeOpacity={0.75}>
            <Text style={styles.avatarEmoji}>{user?.avatar ?? '🎯'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.dateLabel}>{dateLabel}</Text>

        {nearest ? (
          <View style={styles.heroBlock}>
            <Text style={styles.heroNumber}>{daysUntil(nearest.date)}</Text>
            <Text style={styles.heroWord}>DAYS TO</Text>
            <Text style={styles.heroWord}>{nearest.exam}</Text>
          </View>
        ) : (
          <View style={styles.heroBlock}>
            <Text style={styles.heroWord}>KEEP</Text>
            <Text style={styles.heroWord}>SHOWING</Text>
            <Text style={styles.heroWord}>UP</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{appState.streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{appState.longestStreak}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{appState.totalTasksCompleted}</Text>
            <Text style={styles.statLabel}>Tasks Done</Text>
          </View>
        </View>

      </ScrollView>

      <Modal visible={showProfile} transparent animationType="fade" onRequestClose={() => setShowProfile(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowProfile(false)}>
          <View style={styles.profileSheet}>
            <Text style={styles.profileAvatar}>{user?.avatar ?? '🎯'}</Text>
            <Text style={styles.profileName}>{user?.name ?? 'Champion'}</Text>
            <View style={styles.profileExams}>
              {examTypes.map(exam => (
                <View key={exam} style={styles.profileExamChip}>
                  <Text style={styles.profileExamText}>{exam}</Text>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: 56, paddingBottom: 130 },

  topRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: Spacing.xxl },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 22 },

  dateLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },

  heroBlock: { marginBottom: Spacing.xxl },
  heroNumber: {
    fontFamily: DISPLAY_FONT,
    fontWeight: '900',
    fontSize: 96,
    lineHeight: 92,
    color: Colors.primary,
    letterSpacing: -2,
  },
  heroWord: {
    fontFamily: DISPLAY_FONT,
    fontWeight: '900',
    fontSize: 44,
    lineHeight: 48,
    color: Colors.primary,
    letterSpacing: -1,
  },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { ...Typography.labelSmall, color: Colors.textSecondary, textAlign: 'center' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  profileSheet: {
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  profileAvatar: { fontSize: 48 },
  profileName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  profileExams: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: Spacing.sm },
  profileExamChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1, borderColor: Colors.primary,
  },
  profileExamText: { ...Typography.labelSmall, color: Colors.primaryLight },
});
