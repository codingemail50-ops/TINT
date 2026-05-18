import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { MOCK_LEADERBOARD, LeaderboardEntry } from '../data/leaderboard';
import { LeaderboardCard } from '../components/LeaderboardCard';
import { AppState } from '../utils/storage';
import { ExamType } from '../data/examPresets';

interface Props { appState: AppState }

const EXAM_TABS: { id: ExamType; emoji: string; label: string; color: string }[] = [
  { id: 'JEE',   emoji: '⚡', label: 'JEE',   color: '#3B82F6' },
  { id: 'UCEED', emoji: '✏️', label: 'UCEED', color: '#8B5CF6' },
  { id: 'NID',   emoji: '🎨', label: 'NID',   color: '#EC4899' },
  { id: 'NIFT',  emoji: '👗', label: 'NIFT',  color: '#F59E0B' },
];

export const LeaderboardScreen: React.FC<Props> = ({ appState }) => {
  const headerAnim = useRef(new Animated.Value(0)).current;
  const podiumAnim = useRef(new Animated.Value(0)).current;

  const user     = appState.user;
  const examTypes = (user?.examTypes ?? []) as ExamType[];

  // Default tab to first exam the user selected, or JEE
  const [activeExam, setActiveExam] = useState<ExamType>(
    examTypes.length > 0 ? examTypes[0] : 'JEE'
  );

  const userConsistency = appState.history.length > 0
    ? Math.round(appState.history.reduce((s, h) => s + h.consistency, 0) / appState.history.length)
    : 0;

  const userEntry: LeaderboardEntry = {
    id: 'me',
    name: user?.name ?? 'You',
    streak: appState.streak,
    consistency: userConsistency,
    tasksCompleted: appState.totalTasksCompleted,
    avatar: user?.avatar ?? '⭐',
    examType: activeExam,
    isCurrentUser: true,
  };

  // Build tab-filtered leaderboard
  const tabList = buildTabLeaderboard(activeExam, userEntry, examTypes);

  const top3     = tabList.slice(0, 3);
  const userRank = tabList.findIndex(e => e.isCurrentUser) + 1;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(podiumAnim,  { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const activeColor = EXAM_TABS.find(t => t.id === activeExam)?.color ?? Colors.primary;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0A0015', '#080810']} style={StyleSheet.absoluteFill} />

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
                style={[styles.examTab, isActive && { borderColor: tab.color, backgroundColor: tab.color + '22' }]}
                onPress={() => setActiveExam(tab.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.examTabEmoji}>{tab.emoji}</Text>
                <Text style={[styles.examTabLabel, isActive && { color: tab.color }]}>
                  {tab.label}
                </Text>
                {isUserExam && <View style={[styles.examTabDot, { backgroundColor: tab.color }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Your rank banner */}
        {userRank > 0 && (
          <Animated.View style={[styles.userRankBanner, {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            borderColor: activeColor + '44',
          }]}>
            <LinearGradient
              colors={[activeColor + '22', Colors.surface]}
              style={styles.userRankGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <View style={styles.userRankLeft}>
                <Text style={styles.userRankEmoji}>{user?.avatar ?? '⭐'}</Text>
                <View>
                  <Text style={styles.userRankName}>{user?.name ?? 'You'}</Text>
                  <Text style={styles.userRankMeta}>{userConsistency}% consistent · 🔥{appState.streak}d</Text>
                </View>
              </View>
              <View style={styles.userRankRight}>
                <Text style={[styles.userRankNumber, { color: activeColor }]}>
                  {userRank > 0 ? `#${userRank}` : '--'}
                </Text>
                <Text style={styles.userRankLabel}>
                  {examTypes.includes(activeExam) ? 'your rank' : 'not your exam'}
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Podium */}
        <Animated.View style={[styles.podiumSection, {
          opacity:   podiumAnim,
          transform: [{ scale: podiumAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
        }]}>
          <Text style={styles.sectionTitle}>Top 3 🏆</Text>
          <View style={styles.podium}>
            {top3[1] && (
              <View style={[styles.podiumBlock, styles.podiumSecond]}>
                <Text style={styles.podiumAvatar}>{top3[1].avatar}</Text>
                <Text style={styles.podiumName} numberOfLines={1}>{top3[1].name}</Text>
                <View style={[styles.podiumPedestal, { height: 64, backgroundColor: '#9CA3AF33' }]}>
                  <Text style={styles.podiumMedal}>🥈</Text>
                  <Text style={styles.podiumConsistency}>{top3[1].consistency}%</Text>
                </View>
              </View>
            )}
            {top3[0] && (
              <View style={[styles.podiumBlock, styles.podiumFirst]}>
                <Text style={styles.podiumCrown}>👑</Text>
                <Text style={styles.podiumAvatar}>{top3[0].avatar}</Text>
                <Text style={styles.podiumName} numberOfLines={1}>{top3[0].name}</Text>
                <View style={[styles.podiumPedestal, { height: 90, backgroundColor: '#F59E0B33' }]}>
                  <Text style={styles.podiumMedal}>🥇</Text>
                  <Text style={styles.podiumConsistency}>{top3[0].consistency}%</Text>
                </View>
              </View>
            )}
            {top3[2] && (
              <View style={[styles.podiumBlock, styles.podiumThird]}>
                <Text style={styles.podiumAvatar}>{top3[2].avatar}</Text>
                <Text style={styles.podiumName} numberOfLines={1}>{top3[2].name}</Text>
                <View style={[styles.podiumPedestal, { height: 48, backgroundColor: '#CD7C3233' }]}>
                  <Text style={styles.podiumMedal}>🥉</Text>
                  <Text style={styles.podiumConsistency}>{top3[2].consistency}%</Text>
                </View>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Full list */}
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
          <LinearGradient
            colors={[activeColor + '22', Colors.surface]}
            style={styles.motivationGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={styles.motivationText}>
              Rankings update as your consistency grows. Every task you complete today moves you up the board.
            </Text>
            <Text style={[styles.motivationCta, { color: activeColor }]}>
              Keep your streak alive 🔥
            </Text>
          </LinearGradient>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

function buildTabLeaderboard(
  activeExam: ExamType,
  userEntry: LeaderboardEntry,
  userExamTypes: ExamType[],
): (LeaderboardEntry & { _rank: number })[] {
  const filtered = MOCK_LEADERBOARD.filter(e => e.examType === activeExam);
  const withUser = userExamTypes.includes(activeExam)
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
  screenTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
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
  examTabEmoji: { fontSize: 18 },
  examTabLabel: { ...Typography.labelSmall, color: Colors.textSecondary, fontSize: 10 },
  examTabDot: {
    width: 5, height: 5, borderRadius: 3,
    position: 'absolute', top: 5, right: 8,
  },

  // User rank banner
  userRankBanner: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  userRankGradient: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: Spacing.md,
  },
  userRankLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  userRankEmoji: { fontSize: 32 },
  userRankName:  { ...Typography.headlineSmall, color: Colors.textPrimary },
  userRankMeta:  { ...Typography.bodySmall, color: Colors.textSecondary },
  userRankRight: { alignItems: 'flex-end' },
  userRankNumber: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  userRankLabel:  { ...Typography.labelSmall, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },

  // Podium
  podiumSection: { marginBottom: Spacing.xl },
  sectionTitle:  { ...Typography.headlineSmall, color: Colors.textPrimary, marginBottom: Spacing.md },
  podium: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'center', gap: Spacing.xs, height: 180,
  },
  podiumBlock:  { flex: 1, alignItems: 'center', gap: 4 },
  podiumFirst:  {},
  podiumSecond: {},
  podiumThird:  {},
  podiumCrown:  { fontSize: 20 },
  podiumAvatar: { fontSize: 28 },
  podiumName: {
    ...Typography.bodySmall, color: Colors.textPrimary,
    fontWeight: '600', textAlign: 'center', fontSize: 11,
  },
  podiumPedestal: {
    width: '100%',
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingTop: 8,
  },
  podiumMedal:       { fontSize: 20 },
  podiumConsistency: { ...Typography.labelSmall, color: Colors.textSecondary, fontSize: 11 },

  listSection: { marginBottom: Spacing.md },

  motivationFooter: {
    borderRadius: BorderRadius.lg, overflow: 'hidden',
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '33',
  },
  motivationGradient: { padding: Spacing.md, gap: Spacing.xs },
  motivationText: {
    ...Typography.bodyMedium, color: Colors.textSecondary,
    lineHeight: 22, textAlign: 'center',
  },
  motivationCta: { ...Typography.labelLarge, textAlign: 'center' },
});
