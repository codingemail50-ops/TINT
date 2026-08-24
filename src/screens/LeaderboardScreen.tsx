import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { LeaderboardEntry, LeaderboardPeriod, minsForPeriod, MOCK_LEADERBOARD_BOTS } from '../data/leaderboard';
import { LeaderboardCard } from '../components/LeaderboardCard';
import { LeaderboardPodium } from '../components/LeaderboardPodium';
import { AppState, computeLifetimeConsistency } from '../utils/storage';
import { loadLeaderboard, loadFriendsLeaderboard, CloudLeaderboardRow } from '../utils/supabaseStorage';
import { loadFocusLog, computeFocusStats } from '../utils/focusLog';

interface Props { appState: AppState; userId?: string }

type Scope = 'local' | 'global';

const PERIOD_TABS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'overall', label: 'Overall' },
];

export const LeaderboardScreen: React.FC<Props> = ({ appState, userId }) => {
  const [scope, setScope] = useState<Scope>('global');
  const [period, setPeriod] = useState<LeaderboardPeriod>('today');
  const [rows, setRows] = useState<CloudLeaderboardRow[]>([]);
  const [myFocus, setMyFocus] = useState({ today: 0, week: 0, allTime: 0 });

  useEffect(() => {
    (scope === 'local' ? loadFriendsLeaderboard() : loadLeaderboard()).then(setRows);
  }, [scope]);

  useEffect(() => {
    loadFocusLog().then(log => setMyFocus(computeFocusStats(log)));
  }, []);

  const user = appState.user;
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
    focusTodayMins: myFocus.today,
    focusWeekMins: myFocus.week,
    focusAllTimeMins: myFocus.allTime,
    isCurrentUser: true,
  };

  const entries: LeaderboardEntry[] = useMemo(() => {
    const cloud: LeaderboardEntry[] = rows.map(r => ({
      id: r.id,
      name: r.name,
      streak: r.streak,
      consistency: r.consistency,
      tasksCompleted: r.tasksCompleted,
      avatar: r.avatar,
      focusTodayMins: r.focusTodayMins,
      focusWeekMins: r.focusWeekMins,
      focusAllTimeMins: r.focusAllTimeMins,
      isCurrentUser: !!userId && r.id === userId,
    }));
    // Placeholder bots only ever fill in for an empty real result — never
    // blended in once the backend actually returns rows.
    const base = cloud.length > 0 ? cloud : MOCK_LEADERBOARD_BOTS;
    const hasUser = base.some(e => e.isCurrentUser);
    const all = hasUser ? base : [...base, userEntry];
    return [...all].sort((a, b) => minsForPeriod(b, period) - minsForPeriod(a, period));
  }, [rows, period, userId, myFocus]);

  const top3 = entries.slice(0, 3);
  const meIndex = entries.findIndex(e => e.isCurrentUser);
  const meEntry = meIndex >= 0 ? entries[meIndex] : null;

  const rest = entries.slice(3).map((entry, i) => ({ entry, rank: i + 4 })).filter(x => !x.entry.isCurrentUser);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Locked In</Text>

        <View style={styles.periodRow}>
          {PERIOD_TABS.map(tab => (
            <TouchableOpacity key={tab.id} onPress={() => setPeriod(tab.id)} activeOpacity={0.7}>
              <Text style={[styles.periodTab, period === tab.id && styles.periodTabActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.scopeRow}>
          <TouchableOpacity
            style={[styles.scopeBtn, scope === 'local' && styles.scopeBtnActive]}
            onPress={() => setScope('local')}
            activeOpacity={0.8}
          >
            <Text style={[styles.scopeText, scope === 'local' && styles.scopeTextActive]}>Local</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scopeBtn, scope === 'global' && styles.scopeBtnActive]}
            onPress={() => setScope('global')}
            activeOpacity={0.8}
          >
            <Text style={[styles.scopeText, scope === 'global' && styles.scopeTextActive]}>Global</Text>
          </TouchableOpacity>
        </View>

        {top3.length > 0 && <LeaderboardPodium top3={top3} period={period} />}

        <View style={styles.listCard}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderRank}>#</Text>
            <Text style={styles.listHeaderName}>Player</Text>
            <Text style={styles.listHeaderValue}>Time</Text>
          </View>

          {meEntry && meIndex >= 3 && (
            <LeaderboardCard entry={meEntry} rank={meIndex + 1} period={period} />
          )}

          {rest.map(({ entry, rank }) => (
            <LeaderboardCard key={entry.id} entry={entry} rank={rank} period={period} />
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: 56 },

  title: { fontSize: 32, fontFamily: Fonts.pixel, color: Colors.textPrimary, letterSpacing: 0.5, marginBottom: Spacing.md },

  periodRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.md },
  periodTab: { fontSize: 12, fontFamily: Fonts.semibold, color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  periodTabActive: { color: Colors.textPrimary },

  scopeRow: {
    flexDirection: 'row', backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full, padding: 4, marginBottom: Spacing.xl,
  },
  scopeBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: BorderRadius.full },
  scopeBtnActive: { backgroundColor: Colors.primary },
  scopeText: { fontSize: 13, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  scopeTextActive: { color: Colors.background },

  listCard: { marginTop: Spacing.xl },
  listHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.xs,
  },
  listHeaderRank: { width: 24, fontSize: 11, fontFamily: Fonts.semibold, color: Colors.textMuted, textTransform: 'uppercase' },
  listHeaderName: { flex: 1, fontSize: 11, fontFamily: Fonts.semibold, color: Colors.textMuted, textTransform: 'uppercase' },
  listHeaderValue: { fontSize: 11, fontFamily: Fonts.semibold, color: Colors.textMuted, textTransform: 'uppercase' },
});
