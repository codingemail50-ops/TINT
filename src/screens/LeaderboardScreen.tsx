import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { LeaderboardEntry, LeaderboardPeriod, minsForPeriod } from '../data/leaderboard';
import { LeaderboardCard } from '../components/LeaderboardCard';
import { LeaderboardPodium } from '../components/LeaderboardPodium';
import { FriendsPanel } from '../components/FriendsPanel';
import { AppState, computeLifetimeConsistency } from '../utils/storage';
import { loadLeaderboard, loadFriendsLeaderboard, CloudLeaderboardRow } from '../utils/supabaseStorage';
import { loadFocusLog, computeFocusStats } from '../utils/focusLog';

interface Props { appState: AppState; userId?: string }

// 'local' is the internal id (matches the existing friends-scoped query) —
// only the displayed label changed to "Squad", since testers found "Local"
// unclear as a name for "just my friends."
type Scope = 'local' | 'global';
const EXAM_ALL = 'all';

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
  const [examFilter, setExamFilter] = useState<string>(EXAM_ALL);

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

  // Competing purely on raw focus time doesn't make sense across different
  // exams — this is the current user's own enrolled exam list, used both to
  // decide whether to even show the toggle (no point with just one) and as
  // the set of tabs offered.
  const myExams = (user?.examTypes ?? []) as string[];

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
    exams: myExams,
  };

  const entries: LeaderboardEntry[] = useMemo(() => {
    const filteredRows = examFilter === EXAM_ALL ? rows : rows.filter(r => r.exams.includes(examFilter));
    const cloud: LeaderboardEntry[] = filteredRows.map(r => ({
      id: r.id,
      name: r.name,
      streak: r.streak,
      consistency: r.consistency,
      tasksCompleted: r.tasksCompleted,
      avatar: r.avatar,
      exams: r.exams,
      focusTodayMins: r.focusTodayMins,
      focusWeekMins: r.focusWeekMins,
      focusAllTimeMins: r.focusAllTimeMins,
      isCurrentUser: !!userId && r.id === userId,
    }));
    const hasUser = cloud.some(e => e.isCurrentUser);
    const withMe = hasUser ? cloud : [...cloud, userEntry];
    // Applies even when the exam filter already scoped the query, so "me"
    // never shows up under a tab I'm not actually enrolled in.
    const all = examFilter === EXAM_ALL ? withMe : withMe.filter(e => !e.isCurrentUser || myExams.includes(examFilter));
    return [...all].sort((a, b) => minsForPeriod(b, period) - minsForPeriod(a, period));
  }, [rows, period, userId, myFocus, examFilter, myExams]);

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
            <Text style={[styles.scopeText, scope === 'local' && styles.scopeTextActive]}>Squad</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scopeBtn, scope === 'global' && styles.scopeBtnActive]}
            onPress={() => setScope('global')}
            activeOpacity={0.8}
          >
            <Text style={[styles.scopeText, scope === 'global' && styles.scopeTextActive]}>Global</Text>
          </TouchableOpacity>
        </View>

        {/* Only worth showing when there's an actual choice to make —
            enrolled in one exam, "compare within my exam" is the whole
            leaderboard already. */}
        {myExams.length > 1 && (
          <View style={styles.examRow}>
            <TouchableOpacity onPress={() => setExamFilter(EXAM_ALL)} activeOpacity={0.7}>
              <Text style={[styles.examTab, examFilter === EXAM_ALL && styles.examTabActive]}>All</Text>
            </TouchableOpacity>
            {myExams.map(exam => (
              <TouchableOpacity key={exam} onPress={() => setExamFilter(exam)} activeOpacity={0.7}>
                <Text style={[styles.examTab, examFilter === exam && styles.examTabActive]}>{exam}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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

        {/* Friend requests are the app's main USP but used to live only in
            Profile, a screen people rarely open — surfaced here too, right
            where someone looking at their Squad would want to grow it. */}
        {scope === 'local' && (
          <View style={styles.friendsSection}>
            <FriendsPanel userId={userId} />
          </View>
        )}

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
    borderRadius: BorderRadius.full, padding: 4, marginBottom: Spacing.md,
  },
  scopeBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: BorderRadius.full },
  scopeBtnActive: { backgroundColor: Colors.primary },
  scopeText: { fontSize: 13, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  scopeTextActive: { color: Colors.background },

  examRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl, flexWrap: 'wrap' },
  examTab: {
    fontSize: 12, fontFamily: Fonts.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.4,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  examTabActive: { color: Colors.pop, borderColor: Colors.pop },

  friendsSection: {
    marginTop: Spacing.xl, paddingTop: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },

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
