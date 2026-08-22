import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { LeaderboardEntry } from '../data/leaderboard';
import { LeaderboardCard } from '../components/LeaderboardCard';
import { PixelIcon } from '../components/PixelIcon';
import { AppState } from '../utils/storage';
import { ExamType } from '../data/examPresets';
import { loadLeaderboard, CloudLeaderboardRow } from '../utils/supabaseStorage';

interface Props { appState: AppState; userId?: string }

const EXAM_TABS: { id: ExamType; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { id: 'JEE',   icon: 'flash',         label: 'JEE' },
  { id: 'UCEED', icon: 'pencil',        label: 'UCEED' },
  { id: 'NID',   icon: 'color-palette', label: 'NID' },
  { id: 'NIFT',  icon: 'shirt',         label: 'NIFT' },
];

export const LeaderboardScreen: React.FC<Props> = ({ appState, userId }) => {
  const headerAnim = useRef(new Animated.Value(0)).current;

  const user     = appState.user;
  const examTypes = (user?.examTypes ?? []) as ExamType[];

  // Default tab to first exam the user selected, or JEE
  const [activeExam, setActiveExam] = useState<ExamType>(
    examTypes.length > 0 ? examTypes[0] : 'JEE'
  );

  const [cloudRows, setCloudRows] = useState<CloudLeaderboardRow[]>([]);
  useEffect(() => {
    loadLeaderboard().then(setCloudRows);
  }, []);

  const userConsistency = appState.history.length > 0
    ? Math.round(appState.history.reduce((s, h) => s + h.consistency, 0) / appState.history.length)
    : 0;

  const userEntry: LeaderboardEntry = {
    id: userId ?? 'me',
    name: user?.name ?? 'You',
    streak: appState.streak,
    consistency: userConsistency,
    tasksCompleted: appState.totalTasksCompleted,
    avatar: user?.avatar ?? 'star',
    examType: activeExam,
    isCurrentUser: true,
  };

  // Build tab-filtered leaderboard
  const tabList = buildTabLeaderboard(activeExam, cloudRows, userId, userEntry, examTypes);

  const userRank = tabList.findIndex(e => e.isCurrentUser) + 1;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerAnim }]}>
          <Text style={styles.screenTitle}>Leaderboard</Text>
          <Text style={styles.screenSub}>How do you rank in your exam?</Text>
        </Animated.View>

        {/* Exam tabs */}
        <View style={styles.examTabs}>
          {EXAM_TABS.map(tab => {
            const isActive   = activeExam === tab.id;
            const isUserExam = examTypes.includes(tab.id);
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.examTab, isActive && styles.examTabActive]}
                onPress={() => setActiveExam(tab.id)}
                activeOpacity={0.7}
              >
                <Ionicons name={tab.icon} size={18} color={isActive ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.examTabLabel, isActive && styles.examTabLabelActive]}>
                  {tab.label}
                </Text>
                {isUserExam && <View style={styles.examTabDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Your rank banner */}
        {userRank > 0 && (
          <Animated.View style={[styles.userRankBanner, {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }]}>
            <View style={styles.userRankGradient}>
              <View style={styles.userRankLeft}>
                <View style={styles.userRankAvatar}>
                  <PixelIcon name={user?.avatar ?? 'star'} size={26} />
                </View>
                <View>
                  <Text style={styles.userRankName}>{user?.name ?? 'You'}</Text>
                  <Text style={styles.userRankMeta}>{userConsistency}% consistent · {appState.streak}d streak</Text>
                </View>
              </View>
              <View style={styles.userRankRight}>
                <Text style={styles.userRankNumber}>
                  {userRank > 0 ? `#${userRank}` : '--'}
                </Text>
                <Text style={styles.userRankLabel}>
                  {examTypes.includes(activeExam) ? 'your rank' : 'not your exam'}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Cascading staircase leaderboard */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>All {activeExam} Students</Text>
          {tabList.map((entry, index) => (
            <LeaderboardCard
              key={entry.id}
              entry={entry}
              rank={index + 1}
              index={index}
            />
          ))}
        </View>

        <View style={styles.motivationFooter}>
          <View style={styles.motivationGradient}>
            <Text style={styles.motivationText}>
              Rankings update as your consistency grows. Every task you complete today moves you up the board.
            </Text>
            <Text style={styles.motivationCta}>
              Keep your streak alive
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

function buildTabLeaderboard(
  activeExam: ExamType,
  cloudRows: CloudLeaderboardRow[],
  userId: string | undefined,
  userEntry: LeaderboardEntry,
  userExamTypes: ExamType[],
): (LeaderboardEntry & { _rank: number })[] {
  const filtered: LeaderboardEntry[] = cloudRows
    .filter(r => (r.exams as ExamType[]).includes(activeExam))
    .map(r => ({
      id: r.id,
      name: r.name,
      streak: r.streak,
      consistency: r.consistency,
      tasksCompleted: r.tasksCompleted,
      avatar: r.avatar,
      examType: activeExam,
      isCurrentUser: !!userId && r.id === userId,
    }));

  const hasUser = filtered.some(e => e.isCurrentUser);
  const withUser = (!hasUser && userExamTypes.includes(activeExam))
    ? [...filtered, userEntry]
    : filtered;

  return withUser
    .sort((a, b) => b.consistency - a.consistency || b.streak - a.streak)
    .map((e, i) => ({ ...e, _rank: i + 1 }));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll:    { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },

  header: {
    paddingTop: 56, paddingBottom: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.xl, paddingHorizontal: Spacing.xl,
  },
  screenTitle: { fontSize: 28, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: -0.5 },
  screenSub:   { ...Typography.bodyMedium, color: Colors.textSecondary, marginTop: 4 },

  // Exam tabs
  examTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  examTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    gap: 2,
  },
  examTabActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  examTabLabel: { ...Typography.labelSmall, color: Colors.textSecondary, fontSize: 10 },
  examTabLabelActive: { color: Colors.primary },
  examTabDot: {
    width: 5, height: 5, borderRadius: 3,
    position: 'absolute', top: 5, right: 8,
    backgroundColor: Colors.primary,
  },

  // User rank banner
  userRankBanner: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userRankGradient: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
  },
  userRankLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  userRankAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  userRankName:  { ...Typography.headlineSmall, color: Colors.textPrimary },
  userRankMeta:  { ...Typography.bodySmall, color: Colors.textSecondary },
  userRankRight: { alignItems: 'flex-end' },
  userRankNumber: { fontSize: 32, fontFamily: Fonts.bold, letterSpacing: -1, color: Colors.primary },
  userRankLabel:  { ...Typography.labelSmall, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },

  sectionTitle: { ...Typography.headlineSmall, color: Colors.textPrimary, marginBottom: Spacing.md },
  listSection: { marginBottom: Spacing.md },

  motivationFooter: {
    borderRadius: BorderRadius.lg, overflow: 'hidden',
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  motivationGradient: { padding: Spacing.md, gap: Spacing.xs, backgroundColor: Colors.surfaceElevated },
  motivationText: {
    ...Typography.bodyMedium, color: Colors.textSecondary,
    lineHeight: 22, textAlign: 'center',
  },
  motivationCta: { ...Typography.labelLarge, textAlign: 'center', color: Colors.primary },
});
