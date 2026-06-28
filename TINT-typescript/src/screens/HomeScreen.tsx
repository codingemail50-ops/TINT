import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Task, UserProfile, HistoryEntry, FocusLog } from '../types';
import { storage } from '../utils/storage';
import { syncToCloud } from '../utils/supabase';
import {
  getAppDate,
  calcProgress,
  calcStreak,
  getStreakColor,
  formatMinutes,
  calcFocusMetrics,
  daysUntil,
  buildHistoryEntry,
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

export default function HomeScreen({ profile }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [focusLog, setFocusLog] = useState<FocusLog[]>([]);
  const [streak, setStreak] = useState(0);
  const [streakColor, setStreakColor] = useState('#FBBF24');
  const [pct, setPct] = useState(0);

  const progressAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const [t, h, f] = await Promise.all([
      storage.getTasks(),
      storage.getHistory(),
      storage.getFocusLog(),
    ]);

    // Daily reset: if tasks are from a previous day, archive and reset
    const today = getAppDate();
    const lastReset = await storage.getLastReset();
    let currentTasks = t;
    let currentHistory = h;

    if (lastReset && lastReset !== today && t.length > 0) {
      const entry = buildHistoryEntry(t, lastReset);
      currentHistory = [...h, entry];
      currentTasks = t.map(task => ({ ...task, status: 'upcoming' as const }));
      await storage.setHistory(currentHistory);
      await storage.setTasks(currentTasks);
      await storage.setLastReset(today);
      syncToCloud(profile.email, profile, currentTasks, currentHistory, f).catch(() => {});
    }

    setTasks(currentTasks);
    setHistory(currentHistory);
    setFocusLog(f);

    const { streak: s } = calcStreak(currentHistory);
    setStreak(s);
    setStreakColor(getStreakColor(s));

    const { pct: p } = calcProgress(currentTasks);
    setPct(p);

    Animated.timing(progressAnim, {
      toValue: p / 100,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [profile, progressAnim]);

  useEffect(() => { load(); }, [load]);

  async function toggleTask(id: string) {
    const updated = tasks.map(t =>
      t.id === id ? { ...t, status: t.status === 'done' ? 'upcoming' as const : 'done' as const } : t
    );
    setTasks(updated);
    await storage.setTasks(updated);

    const { pct: p } = calcProgress(updated);
    setPct(p);
    Animated.timing(progressAnim, {
      toValue: p / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();

    syncToCloud(profile.email, profile, updated, history, focusLog).catch(() => {});
  }

  const { focusToday } = calcFocusMetrics(focusLog);
  const countdowns = profile.exams
    .map(e => ({ exam: e, days: daysUntil(EXAM_COUNTDOWNS[e]) }))
    .sort((a, b) => a.days - b.days);

  const studyTasks = tasks.filter(t => t.cat !== 'health');
  const healthTasks = tasks.filter(t => t.cat === 'health');
  const doneCount = studyTasks.filter(t => t.status === 'done').length;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Good day,</Text>
            <Text style={s.name}>{profile.avatar} {profile.name}</Text>
          </View>
          <View style={s.streakBadge}>
            <Text style={s.streakFlame}>🔥</Text>
            <Text style={[s.streakNum, { color: streakColor }]}>{streak}</Text>
          </View>
        </View>

        {/* Progress card */}
        <View style={s.progressCard}>
          <View style={s.progressTop}>
            <Text style={s.progressLabel}>Today's progress</Text>
            <Text style={s.progressPct}>{pct}%</Text>
          </View>
          <View style={s.progressTrack}>
            <Animated.View
              style={[
                s.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: pct === 100 ? '#22C55E' : '#6366F1',
                },
              ]}
            />
          </View>
          <Text style={s.progressSub}>
            {doneCount}/{studyTasks.length} tasks done
            {focusToday > 0 ? `  •  ${formatMinutes(focusToday)} focused` : ''}
          </Text>
        </View>

        {/* Exam countdowns */}
        {countdowns.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.countdownRow}>
            {countdowns.map(({ exam, days }) => (
              <View key={exam} style={s.countdownChip}>
                <Text style={s.countdownDays}>{days}</Text>
                <Text style={s.countdownLabel}>days to {exam}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Study tasks */}
        <Text style={s.sectionTitle}>Study tasks</Text>
        {studyTasks.map(task => (
          <TaskRow key={task.id} task={task} onToggle={toggleTask} />
        ))}

        {/* Health tasks */}
        {healthTasks.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 24 }]}>Health</Text>
            {healthTasks.map(task => (
              <TaskRow key={task.id} task={task} onToggle={toggleTask} />
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const done = task.status === 'done';
  const color = CAT_COLORS[task.cat] ?? '#6366F1';

  return (
    <TouchableOpacity
      style={[s.taskRow, done && s.taskRowDone]}
      onPress={() => onToggle(task.id)}
      activeOpacity={0.7}
    >
      <View style={[s.taskCheck, done && { backgroundColor: color, borderColor: color }]}>
        {done && <Text style={s.taskCheckMark}>✓</Text>}
      </View>
      <Text style={s.taskEmoji}>{task.emoji}</Text>
      <View style={s.taskInfo}>
        <Text style={[s.taskTitle, done && s.taskTitleDone]}>{task.title}</Text>
        <Text style={s.taskMeta}>{task.dur}min · <Text style={{ color }}>{task.cat}</Text></Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080810' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  streakBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  streakFlame: { fontSize: 18 },
  streakNum: { fontSize: 20, fontWeight: '800', marginTop: 2 },

  // Progress card
  progressCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, marginBottom: 16 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  progressLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  progressPct: { color: '#fff', fontSize: 16, fontWeight: '700' },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 10 },

  // Countdown chips
  countdownRow: { marginBottom: 24 },
  countdownChip: { backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, marginRight: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)', alignItems: 'center' },
  countdownDays: { color: '#6366F1', fontSize: 22, fontWeight: '800' },
  countdownLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  // Section
  sectionTitle: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },

  // Task rows
  taskRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, marginBottom: 8 },
  taskRowDone: { opacity: 0.55 },
  taskCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  taskCheckMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  taskEmoji: { fontSize: 22, marginRight: 12 },
  taskInfo: { flex: 1 },
  taskTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  taskTitleDone: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.4)' },
  taskMeta: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 },
});
