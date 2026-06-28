import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LeaderboardEntry, UserProfile } from '../types';
import { fetchLeaderboard } from '../utils/supabase';
import { formatMinutes } from '../utils/logic';

const TABS = ['Consistency', 'Streak', 'Focus'] as const;
type Tab = typeof TABS[number];

interface Props {
  profile: UserProfile;
}

export default function LeaderboardScreen({ profile }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [tab, setTab] = useState<Tab>('Consistency');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const data = await fetchLeaderboard();
    setEntries(data as LeaderboardEntry[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = [...entries].sort((a, b) => {
    if (tab === 'Consistency') return b.consistency_score - a.consistency_score;
    if (tab === 'Streak') return b.streak - a.streak;
    return b.focus_total - a.focus_total;
  });

  const myRank = sorted.findIndex(e => e.email === profile.email) + 1;

  function getValue(e: LeaderboardEntry) {
    if (tab === 'Consistency') return `${Math.round(e.consistency_score)}%`;
    if (tab === 'Streak') return `${e.streak}🔥`;
    return formatMinutes(e.focus_total);
  }

  function getMedal(rank: number) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Leaderboard</Text>
        {myRank > 0 && (
          <View style={s.myRankBadge}>
            <Text style={s.myRankText}>You #{myRank}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#6366F1" size="large" />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => item.email}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#6366F1"
            />
          }
          contentContainerStyle={s.list}
          renderItem={({ item, index }) => {
            const rank = index + 1;
            const isMe = item.email === profile.email;
            const medal = getMedal(rank);
            return (
              <View style={[s.row, isMe && s.rowMe]}>
                <View style={s.rankWrap}>
                  {medal
                    ? <Text style={s.medal}>{medal}</Text>
                    : <Text style={s.rank}>{rank}</Text>
                  }
                </View>
                <Text style={s.avatar}>{item.avatar}</Text>
                <View style={s.info}>
                  <Text style={[s.name, isMe && s.nameMe]}>
                    {item.name}{isMe ? ' (you)' : ''}
                  </Text>
                  <Text style={s.sub}>
                    {item.streak}🔥  ·  {Math.round(item.consistency_score)}% consistent
                  </Text>
                </View>
                <Text style={[s.value, isMe && s.valueMe]}>{getValue(item)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.empty}>No data yet. Complete tasks to appear here!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080810' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  myRankBadge: { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' },
  myRankText: { color: '#6366F1', fontSize: 13, fontWeight: '700' },

  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#6366F1' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, marginBottom: 8 },
  rowMe: { backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  rankWrap: { width: 32, alignItems: 'center' },
  rank: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '700' },
  medal: { fontSize: 20 },
  avatar: { fontSize: 26, marginHorizontal: 10 },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  nameMe: { color: '#818CF8' },
  sub: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 },
  value: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '700' },
  valueMe: { color: '#6366F1' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty: { color: 'rgba(255,255,255,0.3)', fontSize: 14, textAlign: 'center' },
});
