import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { MOCK_LEADERBOARD, LeaderboardEntry } from '../data/leaderboard';
import { LeaderboardCard } from '../components/LeaderboardCard';
import { AppState } from '../utils/storage';

interface Props {
  appState: AppState;
}

export const LeaderboardScreen: React.FC<Props> = ({ appState }) => {
  const headerAnim = useRef(new Animated.Value(0)).current;
  const podiumAnim = useRef(new Animated.Value(0)).current;

  const user = appState.user;

  // Build leaderboard with user injected at their real position
  const userEntry: LeaderboardEntry = {
    id: 'me',
    name: user?.name ?? 'You',
    streak: appState.streak,
    consistency: appState.history.length > 0
      ? Math.round(appState.history.reduce((s, h) => s + h.consistency, 0) / appState.history.length)
      : 0,
    tasksCompleted: appState.totalTasksCompleted,
    avatar: '⭐',
    examType: user?.examType ?? 'CUSTOM',
    isCurrentUser: true,
  };

  const fullList: (LeaderboardEntry & { _rank: number })[] = [...MOCK_LEADERBOARD, userEntry]
    .sort((a, b) => b.consistency - a.consistency || b.streak - a.streak)
    .map((e, i) => ({ ...e, _rank: i + 1 }));

  const userRank = fullList.findIndex(e => e.isCurrentUser) + 1;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(podiumAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const top3 = fullList.slice(0, 3);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0A0015', '#080810']} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerAnim }]}>
          <Text style={styles.screenTitle}>Leaderboard</Text>
          <Text style={styles.screenSub}>Where do you stand?</Text>
        </Animated.View>

        {/* User rank banner */}
        <Animated.View
          style={[
            styles.userRankBanner,
            { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
          ]}
        >
          <LinearGradient
            colors={[Colors.primary + '33', Colors.surface]}
            style={styles.userRankGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.userRankLeft}>
              <Text style={styles.userRankEmoji}>⭐</Text>
              <View>
                <Text style={styles.userRankName}>{user?.name ?? 'You'}</Text>
                <Text style={styles.userRankMeta}>{userEntry.consistency}% consistent · 🔥{userEntry.streak}d</Text>
              </View>
            </View>
            <View style={styles.userRankRight}>
              <Text style={styles.userRankNumber}>#{userRank}</Text>
              <Text style={styles.userRankLabel}>your rank</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Podium */}
        <Animated.View style={[styles.podiumSection, { opacity: podiumAnim, transform: [{ scale: podiumAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
          <Text style={styles.sectionTitle}>Top 3 🏆</Text>
          <View style={styles.podium}>
            {/* 2nd place */}
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
            {/* 1st place */}
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
            {/* 3rd place */}
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
          <Text style={styles.sectionTitle}>Full Rankings</Text>
          {fullList.map((entry, index) => (
            <LeaderboardCard
              key={entry.id}
              entry={entry}
              rank={entry._rank}
              index={index}
            />
          ))}
        </View>

        {/* Motivation footer */}
        <View style={styles.motivationFooter}>
          <LinearGradient
            colors={[Colors.primaryGlow, Colors.surface]}
            style={styles.motivationGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.motivationText}>
              Rankings update as your consistency grows. Every task you complete today moves you up the board.
            </Text>
            <Text style={styles.motivationCta}>Keep your streak alive 🔥</Text>
          </LinearGradient>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  header: {
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  screenSub: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  userRankBanner: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  userRankGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  userRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  userRankEmoji: { fontSize: 32 },
  userRankName: { ...Typography.headlineSmall, color: Colors.textPrimary },
  userRankMeta: { ...Typography.bodySmall, color: Colors.textSecondary },
  userRankRight: { alignItems: 'flex-end' },
  userRankNumber: { fontSize: 32, fontWeight: '900', color: Colors.primary, letterSpacing: -1 },
  userRankLabel: { ...Typography.labelSmall, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  podiumSection: { marginBottom: Spacing.xl },
  sectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 180,
  },
  podiumBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  podiumFirst: { marginBottom: 0 },
  podiumSecond: { marginBottom: 0 },
  podiumThird: { marginBottom: 0 },
  podiumCrown: { fontSize: 20 },
  podiumAvatar: { fontSize: 28 },
  podiumName: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 11,
  },
  podiumPedestal: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
  },
  podiumMedal: { fontSize: 20 },
  podiumConsistency: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  listSection: { marginBottom: Spacing.md },
  motivationFooter: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  motivationGradient: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  motivationText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  motivationCta: {
    ...Typography.labelLarge,
    color: Colors.primaryLight,
    textAlign: 'center',
  },
});
