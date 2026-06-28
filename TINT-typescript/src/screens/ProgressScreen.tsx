import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoryEntry, FocusLog, Task, UserProfile } from '../types';
import { storage } from '../utils/storage';
import {
  calcStreak,
  calcConsistency,
  calcFocusMetrics,
  formatMinutes,
  projectedRank,
  getRepeatedlySkippedTasks,
  daysUntil,
  getStreakColor,
} from '../utils/logic';
import { EXAM_COUNTDOWNS } from '../data/examPresets';

const { width } = Dimensions.get('window');

const CAT_COLORS: Record<string, string> = {
  drawing: '#A855F7',
  aptitude: '#3B82F6',
  theory: '#F59E0B',
  health: '#22C55E',
};

interface Props {
  profile: UserProfile;
}

export default function ProgressScreen({ profile }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [focusLog, setFocusLog] = useState<FocusLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = useCallback(async () => {
    const [h, f, t] = await Promise.all([
      storage.getHistory(),
      storage.getFocusLog(),
      storage.getTasks(),
    ]);
    setHistory(h);
    setFocusLog(f);
    setTasks(t);
  }, []);

  useEffect(() => { load(); }, [load]);

  const { streak, missedDays } = calcStreak(history);
  const consistency = calcConsistency(history);
  const { focusToday, focusWeek, focusTotal } = calcFocusMetrics(focusLog);
  const rank = projectedRank(streak, missedDays);
  const skipped = getRepeatedlySkippedTasks(history, tasks);
  const streakColor = getStreakColor(streak);

  // Focus per category from tasks
  const catFocus: Record<string, number> = {};
  for (const t of tasks) {
    if (t.status === 'done') {
      catFocus[t.cat] = (catFocus[t.cat] ?? 0) + t.dur;
    }
  }
  const maxCatMins = Math.max(...Object.values(catFocus), 1);

  // Last 7 days history bars
  const last7 = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .reverse();

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.pageTitle}>Progress</Text>

        {/* Key stats row */}
        <View style={s.statsRow}>
          <StatCard label="Streak" value={`${streak}`} unit="days" color={streakColor} emoji="🔥" />
          <StatCard label="Consistency" value={`${consistency}`} unit="%" color="#6366F1" emoji="📊" />
          <StatCard label="Missed" value={`${missedDays}`} unit="days" color="#F87171" emoji="💔" />
        </View>

        {/* Projected rank */}
        <View style={s.rankCard}>
          <View>
            <Text style={s.rankLabel}>Projected rank</Text>
            <Text style={s.rankValue}>#{rank}</Text>
            <Text style={s.rankSub}>
              {missedDays === 0
                ? `Keep your ${streak}-day streak going!`
                : `${missedDays} missed day${missedDays > 1 ? 's' : ''} hurting your rank`}
            </Text>
          </View>
          <Text style={s.rankEmoji}>🏆</Text>
        </View>

        {/* Focus time */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Focus time</Text>
          <View style={s.focusRow}>
            <FocusStat label="Today" value={formatMinutes(focusToday)} />
            <FocusStat label="This week" value={formatMinutes(focusWeek)} />
            <FocusStat label="All time" value={formatMinutes(focusTotal)} />
          </View>
        </View>

        {/* Last 7 days */}
        {last7.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Last 7 days</Text>
            <View style={s.barsRow}>
              {last7.map(entry => (
                <View key={entry.date} style={s.barWrap}>
                  <View style={s.barTrack}>
                    <View
                      style={[
                        s.barFill,
                        {
                          height: `${entry.pct}%`,
                          backgroundColor: entry.allDone ? '#22C55E' : entry.pct > 0 ? '#6366F1' : 'rgba(255,255,255,0.08)',
                        },
                      ]}
                    />
                  </View>
                  <Text style={s.barLabel}>{entry.date.slice(5)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Time per topic */}
        {Object.keys(catFocus).length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Time per topic (today)</Text>
            {Object.entries(catFocus).map(([cat, mins]) => (
              <View key={cat} style={s.catRow}>
                <Text style={s.catName}>{cat}</Text>
                <View style={s.catTrack}>
                  <View
                    style={[
                      s.catFill,
                      {
                        width: `${(mins / maxCatMins) * 100}%`,
                        backgroundColor: CAT_COLORS[cat] ?? '#6366F1',
                      },
                    ]}
                  />
                </View>
                <Text style={s.catMins}>{formatMinutes(mins)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Exam countdowns */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Exam countdowns</Text>
          {profile.exams.map(exam => (
            <View key={exam} style={s.examRow}>
              <Text style={s.examName}>{exam}</Text>
              <Text style={s.examDays}>{daysUntil(EXAM_COUNTDOWNS[exam])} days</Text>
            </View>
          ))}
        </View>

        {/* Skipped tasks warning */}
        {skipped.length > 0 && (
          <View style={s.warnCard}>
            <Text style={s.warnTitle}>⚠️ Repeatedly skipped</Text>
            <Text style={s.warnSub}>You've skipped these 3+ times in the last 7 days:</Text>
            {skipped.map(t => (
              <Text key={t} style={s.warnItem}>• {t}</Text>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, unit, color, emoji }: { label: string; value: string; unit: string; color: string; emoji: string }) {
  return (
    <View style={sc.card}>
      <Text style={sc.emoji}>{emoji}</Text>
      <Text style={[sc.value, { color }]}>{value}<Text style={sc.unit}>{unit}</Text></Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}

function FocusStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={sc.focusStat}>
      <Text style={sc.focusValue}>{value}</Text>
      <Text style={sc.focusLabel}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  card: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, alignItems: 'center' },
  emoji: { fontSize: 22, marginBottom: 6 },
  value: { fontSize: 24, fontWeight: '800' },
  unit: { fontSize: 13, fontWeight: '500' },
  label: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 },
  focusStat: { flex: 1, alignItems: 'center' },
  focusValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  focusLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080810' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  pageTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 20 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },

  rankCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)' },
  rankLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 4 },
  rankValue: { color: '#fff', fontSize: 36, fontWeight: '800' },
  rankSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4, maxWidth: width * 0.6 },
  rankEmoji: { fontSize: 48 },

  section: { marginBottom: 24 },
  sectionTitle: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },

  focusRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 },

  barsRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 100 },
  barWrap: { flex: 1, alignItems: 'center' },
  barTrack: { flex: 1, width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6 },
  barLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, marginTop: 4 },

  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  catName: { color: 'rgba(255,255,255,0.5)', fontSize: 12, width: 70, textTransform: 'capitalize' },
  catTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginHorizontal: 10 },
  catFill: { height: 8, borderRadius: 4 },
  catMins: { color: 'rgba(255,255,255,0.4)', fontSize: 12, width: 40, textAlign: 'right' },

  examRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginBottom: 8 },
  examName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  examDays: { color: '#6366F1', fontSize: 15, fontWeight: '700' },

  warnCard: { backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)' },
  warnTitle: { color: '#F87171', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  warnSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 10 },
  warnItem: { color: '#fff', fontSize: 14, marginBottom: 4 },
});
