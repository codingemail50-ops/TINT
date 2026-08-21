import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Easing, Modal, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, Keyboard,
  AppState as RNAppState, AppStateStatus,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { Task, getCombinedPreset, ExamType } from '../data/examPresets';
import { StorageService, AppState } from '../utils/storage';
import { TaskItem } from '../components/TaskItem';
import { FlameBadge } from '../components/FlameBadge';
import { PixelFlame } from '../components/PixelFlame';
import { Confetti } from '../components/Confetti';
import { UCEEDCountdown, NIDCountdown, NIFTCountdown } from '../components/ExamCountdowns';
import { useHaptics } from '../hooks/useHaptics';
import { syncFocusLog } from '../utils/supabaseStorage';
import { FocusLogEntry, loadFocusLog, saveFocusLog, computeFocusStats } from '../utils/focusLog';

const CATEGORIES = [
  'Study', 'Practice', 'Revision', 'Reading', 'Writing',
  'Drawing', 'Design', 'Mathematics', 'Physics', 'Chemistry', 'Other',
];

// ── Duration Slider ──────────────────────────────────────────────────────────
const PRESETS = [30, 60, 90, 120];
const SLIDER_MIN = 15;
const SLIDER_MAX = 180;
const SLIDER_STEP = 15;

const DurationSlider: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const pct = (value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);

  const label = value >= 60
    ? `${Math.floor(value / 60)}h${value % 60 > 0 ? ` ${value % 60}m` : ''}`
    : `${value}m`;

  const handleTrackPress = (e: any) => {
    if (trackWidth <= 0) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    const raw   = SLIDER_MIN + ratio * (SLIDER_MAX - SLIDER_MIN);
    const snapped = Math.round(raw / SLIDER_STEP) * SLIDER_STEP;
    onChange(Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, snapped)));
  };

  return (
    <View style={sliderSt.wrapper}>
      <View style={sliderSt.header}>
        <Text style={sliderSt.label}>Duration</Text>
        <Text style={sliderSt.valueText}>{label}</Text>
      </View>

      {/* Tap-to-seek track */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleTrackPress}
        onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        style={sliderSt.trackHitArea}
      >
        <View style={sliderSt.track}>
          <View style={[sliderSt.fill, { width: trackWidth > 0 ? pct * trackWidth : 0 }]} />
        </View>
        {trackWidth > 0 && (
          <View style={[sliderSt.thumb, {
            left: Math.max(0, Math.min(trackWidth - 20, pct * trackWidth - 10)),
          }]} />
        )}
      </TouchableOpacity>

      <View style={sliderSt.controls}>
        <TouchableOpacity
          style={sliderSt.stepBtn}
          onPress={() => onChange(Math.max(SLIDER_MIN, value - SLIDER_STEP))}
        >
          <Text style={sliderSt.stepBtnText}>− 15m</Text>
        </TouchableOpacity>
        <View style={sliderSt.presets}>
          {PRESETS.map(v => (
            <TouchableOpacity
              key={v}
              style={[sliderSt.preset, value === v && sliderSt.presetActive]}
              onPress={() => onChange(v)}
            >
              <Text style={[sliderSt.presetText, value === v && sliderSt.presetTextActive]}>
                {v >= 60 ? `${v / 60}h` : `${v}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={sliderSt.stepBtn}
          onPress={() => onChange(Math.min(SLIDER_MAX, value + SLIDER_STEP))}
        >
          <Text style={sliderSt.stepBtnText}>+ 15m</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const sliderSt = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { ...Typography.labelSmall, color: Colors.textSecondary },
  valueText: { ...Typography.labelLarge, color: Colors.primary, fontFamily: Fonts.bold },
  trackHitArea: {
    height: 28,
    justifyContent: 'center',
    marginBottom: 10,
  },
  track: {
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -10,
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    borderWidth: 3, borderColor: '#fff',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 6,
    elevation: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stepBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepBtnText: { ...Typography.labelSmall, color: Colors.textSecondary },
  presets: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs },
  preset: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetActive: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
  presetText: { ...Typography.labelSmall, color: Colors.textSecondary },
  presetTextActive: { color: Colors.primary },
});

// ── Active per-task timer row — water drains out as time runs down ──────────
const ActiveTimerRow: React.FC<{
  task: Task;
  remaining: number;
  total: number;
  running: boolean;
  onTogglePause: () => void;
  onCancel: () => void;
}> = ({ task, remaining, total, running, onTogglePause, onCancel }) => {
  const fillPct = total > 0 ? remaining / total : 0; // starts full (1), drains to empty (0)
  const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
  const secs = (remaining % 60).toString().padStart(2, '0');

  const waterAnim = useRef(new Animated.Value(fillPct)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(waterAnim, {
      toValue: fillPct,
      duration: 950,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [fillPct]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rippleAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(rippleAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={timerRowSt.container}>
      <TouchableOpacity style={timerRowSt.main} onPress={onTogglePause} activeOpacity={0.85}>
        <View style={timerRowSt.waterTrack} pointerEvents="none">
          <Animated.View style={[timerRowSt.waterFill, {
            height: waterAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            opacity: running ? 1 : 0.55,
          }]}>
            <Animated.View style={[timerRowSt.waterSurface, {
              transform: [{ translateX: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] }) }],
            }]} />
          </Animated.View>
        </View>

        <View style={timerRowSt.headerRow}>
          <Text style={timerRowSt.title} numberOfLines={1}>{task.title}</Text>
          <Text style={timerRowSt.time}>{mins}:{secs}</Text>
        </View>
        <Text style={timerRowSt.hint}>{running ? 'Tap to pause' : 'Paused — tap to resume'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={timerRowSt.cancelBtn}
        onPress={onCancel}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        <Text style={timerRowSt.cancelText}>Stop</Text>
      </TouchableOpacity>
    </View>
  );
};

const timerRowSt = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.primary, marginBottom: Spacing.sm,
    overflow: 'hidden', padding: Spacing.xs,
  },
  main: { flex: 1, gap: 6, padding: Spacing.sm, position: 'relative', overflow: 'hidden', borderRadius: BorderRadius.sm },
  waterTrack: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' },
  waterFill: { width: '100%', backgroundColor: Colors.water + '4D' },
  waterSurface: { height: 2, width: '112%', marginLeft: '-6%', backgroundColor: Colors.waterSurface },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  title: { ...Typography.bodyLarge, color: Colors.textPrimary, fontFamily: Fonts.semibold, flex: 1 },
  time: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.primary, fontVariant: ['tabular-nums'] },
  hint: { ...Typography.labelSmall, color: Colors.textMuted, fontSize: 10 },
  cancelBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.danger + '55',
  },
  cancelText: { ...Typography.labelSmall, color: Colors.danger },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
interface Props {
  appState: AppState;
  onStateChange: (s: AppState) => void;
  userId?: string;
  onNavigateFocus: () => void;
}

const todayStr = new Date().toDateString();

export const TodoScreen: React.FC<Props> = ({ appState, onStateChange, userId, onNavigateFocus }) => {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([]);

  // Per-task countdown timer — only one active at a time
  const [timerTaskId, setTimerTaskId]   = useState<string | null>(null);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerTotal, setTimerTotal]     = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerEndRef      = useRef(0);
  const timerTaskIdRef   = useRef<string | null>(null);
  const timerTotalRef    = useRef(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Add task modal
  const [showAddModal, setShowAddModal]     = useState(false);
  const [newTaskTitle, setNewTaskTitle]     = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [newTaskCategory, setNewTaskCategory] = useState('Study');
  const [newTaskRepeat, setNewTaskRepeat]   = useState(false);

  // Edit duration modal (long press)
  const [editingTask, setEditingTask]     = useState<Task | null>(null);
  const [editDuration, setEditDuration]   = useState(60);

  // Celebration
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [trophyVisible, setTrophyVisible]   = useState(false);
  const trophyAnim = useRef(new Animated.Value(0)).current;

  const headerGlow = useRef(new Animated.Value(0)).current;
  const { taskComplete, allComplete, buttonPress } = useHaptics();

  const user        = appState.user;
  const examTypes   = (user?.examTypes ?? []) as ExamType[];

  // Load today's tasks
  useEffect(() => {
    (async () => {
      const saved = await StorageService.getTodayTasks();
      if (saved) {
        setTasks(saved);
      } else {
        const fresh = getCombinedPreset(examTypes).map(t => ({ ...t, completed: false }));
        setTasks(fresh);
        await StorageService.saveTodayTasks(fresh);
      }
    })();
    loadFocusLog().then(setFocusLog);
  }, []);

  const viewingPast = selectedDate !== todayStr;
  const pastRecord  = viewingPast
    ? appState.history.find(h => h.date === selectedDate)
    : null;
  const displayTasks = viewingPast ? (pastRecord?.tasks ?? []) : tasks;
  const todoGroup = displayTasks.filter(t => !t.completed && t.id !== timerTaskId);
  const doneGroup = displayTasks.filter(t => t.completed);
  const focusToday = computeFocusStats(focusLog).today;

  const completedCount = displayTasks.filter(t => t.completed).length;
  const totalCount     = displayTasks.length;
  const progress       = totalCount > 0 ? completedCount / totalCount : 0;

  useEffect(() => {
    if (!viewingPast) {
      Animated.timing(headerGlow, { toValue: progress, duration: 500, useNativeDriver: false }).start();
    }
  }, [progress, viewingPast]);

  // ── Task completion (shared by instant un-toggle and timer completion) ───────
  const applyCompletion = useCallback(async (id: string, completed: boolean) => {
    const updated = tasks.map(t =>
      t.id === id ? { ...t, completed, completedAt: completed ? new Date().toISOString() : undefined } : t
    );
    setTasks(updated);
    await StorageService.saveTodayTasks(updated);

    if (completed) {
      await taskComplete();
      setConfettiVisible(true);

      const newDone = updated.filter(t => t.completed).length;
      if (newDone === updated.length && updated.length > 0) {
        setTimeout(() => triggerTrophy(), 1200);
      }
    }

    const newState = await StorageService.recordDayCompletion(updated);
    onStateChange(newState);
  }, [tasks]);

  // ── Per-task countdown timer ──────────────────────────────────────────────────
  const logFocusMinutes = async (mins: number) => {
    if (mins < 1) return;
    const log = await loadFocusLog();
    const updatedLog = [...log, { date: new Date().toDateString(), mins }];
    await saveFocusLog(updatedLog);
    setFocusLog(updatedLog);
    if (userId) void syncFocusLog(userId, updatedLog);
  };

  const stopTimerInterval = () => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
  };

  const finishTimer = useCallback(() => {
    stopTimerInterval();
    const id = timerTaskIdRef.current;
    const mins = Math.round(timerTotalRef.current / 60);
    timerEndRef.current = 0;
    timerTaskIdRef.current = null;
    setTimerTaskId(null);
    setTimerRunning(false);
    setTimerRemaining(0);
    setTimerTotal(0);
    if (id) {
      void applyCompletion(id, true);
      void logFocusMinutes(mins);
    }
  }, [applyCompletion]);

  const tickTimer = useCallback(() => {
    if (timerEndRef.current <= 0) return;
    const remaining = Math.max(0, Math.round((timerEndRef.current - Date.now()) / 1000));
    setTimerRemaining(remaining);
    if (remaining <= 0) finishTimer();
  }, [finishTimer]);

  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(tickTimer, 1000);
      return () => stopTimerInterval();
    }
  }, [timerRunning, tickTimer]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active' && timerEndRef.current > 0) tickTimer();
    };
    const sub = RNAppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [tickTimer]);

  const startTaskTimer = (task: Task) => {
    buttonPress();
    const totalSeconds = task.duration * 60;
    timerTaskIdRef.current = task.id;
    timerTotalRef.current = totalSeconds;
    timerEndRef.current = Date.now() + totalSeconds * 1000;
    setTimerTaskId(task.id);
    setTimerTotal(totalSeconds);
    setTimerRemaining(totalSeconds);
    setTimerRunning(true);
  };

  const toggleTimerPause = () => {
    buttonPress();
    if (timerRunning) {
      stopTimerInterval();
      setTimerRunning(false);
    } else {
      timerEndRef.current = Date.now() + timerRemaining * 1000;
      setTimerRunning(true);
    }
  };

  const cancelTimer = () => {
    buttonPress();
    stopTimerInterval();
    timerEndRef.current = 0;
    timerTaskIdRef.current = null;
    setTimerTaskId(null);
    setTimerRunning(false);
    setTimerRemaining(0);
    setTimerTotal(0);
  };

  const handleTaskPress = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.completed) {
      void applyCompletion(id, false);
      return;
    }
    if (timerTaskId && timerTaskId !== id) return; // one timer at a time
    if (timerTaskId === id) { toggleTimerPause(); return; }
    startTaskTimer(task);
  }, [tasks, timerTaskId, timerRunning, timerRemaining, applyCompletion]);

  const triggerTrophy = async () => {
    await allComplete();
    setTrophyVisible(true);
    Animated.sequence([
      Animated.spring(trophyAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(trophyAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setTrophyVisible(false));
  };

  // ── Delete task ──────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    await StorageService.saveTodayTasks(updated);
    buttonPress();
  }, [tasks]);

  // ── Add task ─────────────────────────────────────────────────────────────────
  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: `custom-${Date.now()}`,
      title: newTaskTitle.trim(),
      duration: newTaskDuration,
      category: newTaskCategory,
      isCustom: true,
      completed: false,
      repeat: newTaskRepeat,
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    await StorageService.saveTodayTasks(updated);
    setNewTaskTitle('');
    setNewTaskDuration(60);
    setNewTaskCategory('Study');
    setNewTaskRepeat(false);
    setShowAddModal(false);
    buttonPress();
  };

  // ── Edit duration (long press) ───────────────────────────────────────────────
  const handleLongPress = (id: string) => {
    if (id === timerTaskId) return; // duration is locked in once a timer is running
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    setEditingTask(task);
    setEditDuration(task.duration);
    buttonPress();
  };

  const handleSaveDuration = async () => {
    if (!editingTask) return;
    const updated = tasks.map(t =>
      t.id === editingTask.id ? { ...t, duration: editDuration } : t
    );
    setTasks(updated);
    await StorageService.saveTodayTasks(updated);
    setEditingTask(null);
    buttonPress();
  };

  const progressColor = progress >= 1 ? Colors.success : progress >= 0.5 ? Colors.primary : Colors.accent;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.header, {
        borderBottomColor: headerGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [Colors.border, Colors.primary + '55'],
        }),
      }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tagline}>THERE IS</Text>
            <Text style={styles.tagline}>NO TOMORROW</Text>
          </View>
          <FlameBadge streak={appState.streak} size={46} onPress={onNavigateFocus} />
        </View>

        {viewingPast && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{selectedDate}</Text>
              <Text style={[styles.progressCount, { color: progressColor }]}>
                {completedCount}/{totalCount}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: progressColor }]} />
            </View>
          </View>
        )}
      </Animated.View>

      {/* ── Task list ──────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!viewingPast && (
          <>
            {/* Fire — the hero, like Opal's crystal */}
            <TouchableOpacity style={styles.heroFlame} onPress={onNavigateFocus} activeOpacity={0.85}>
              <PixelFlame size={150} state="flicker" />
            </TouchableOpacity>

            {/* Exam countdown, right under the hero */}
            {examTypes.length > 0 && (
              <View style={styles.countdownStack}>
                <UCEEDCountdown examTypes={examTypes} />
                <NIDCountdown examTypes={examTypes} />
                <NIFTCountdown examTypes={examTypes} />
              </View>
            )}

            {/* Focus / progress stats row */}
            <View style={styles.pillRow}>
              <View style={styles.pillCol}>
                <View style={[styles.pill, { borderColor: Colors.primary }]}>
                  <Ionicons name="flash" size={14} color={Colors.primary} />
                  <Text style={[styles.pillVal, { color: Colors.primary }]}>{focusToday}</Text>
                </View>
                <Text style={styles.pillLabel}>Focus</Text>
              </View>
              <View style={styles.pillCol}>
                <View style={[styles.pill, { borderColor: Colors.success }]}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                  <Text style={[styles.pillVal, { color: Colors.success }]}>{completedCount}/{totalCount}</Text>
                </View>
                <Text style={styles.pillLabel}>Progress</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.listHeader}>
          {viewingPast && (
            <Text style={styles.listTitle} numberOfLines={1}>Past tasks</Text>
          )}
          {viewingPast ? (
            <TouchableOpacity
              style={styles.backTodayBtn}
              onPress={() => setSelectedDate(todayStr)}
            >
              <Text style={styles.backTodayText}>← Today</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setShowAddModal(true); buttonPress(); }}
              activeOpacity={0.7}
            >
              <View style={styles.addBtnGradient}>
                <Text style={styles.addBtnText}>+ Add Task</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {viewingPast ? (
          displayTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No tasks recorded</Text>
              <Text style={styles.emptyDesc}>No study session was recorded for this day.</Text>
            </View>
          ) : (
            displayTasks.map((task, index) => (
              <TaskItem key={task.id} task={task} readOnly index={index} />
            ))
          )
        ) : displayTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptyDesc}>Tap "+ Add Task" to build your study plan.</Text>
          </View>
        ) : (
          <>
            <View style={[styles.blob, styles.blobTodo]}>
              <Text style={[styles.blobLabel, styles.blobLabelTodo]}>To do</Text>
              {timerTaskId && tasks.find(t => t.id === timerTaskId) && (
                <ActiveTimerRow
                  task={tasks.find(t => t.id === timerTaskId)!}
                  remaining={timerRemaining}
                  total={timerTotal}
                  running={timerRunning}
                  onTogglePause={toggleTimerPause}
                  onCancel={cancelTimer}
                />
              )}
              {todoGroup.length === 0 && !timerTaskId ? (
                <Text style={styles.blobEmpty}>All caught up.</Text>
              ) : (
                todoGroup.map((task, index) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={handleTaskPress}
                    onDelete={task.isCustom ? handleDelete : undefined}
                    onLongPress={handleLongPress}
                    index={index}
                  />
                ))
              )}
            </View>

            {doneGroup.length > 0 && (
              <View style={[styles.blob, styles.blobDone]}>
                <Text style={[styles.blobLabel, styles.blobLabelDone]}>Done</Text>
                {doneGroup.map((task, index) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={handleTaskPress}
                    index={index}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {!viewingPast && completedCount > 0 && completedCount < totalCount && (
          <View style={styles.nudge}>
            <View style={styles.nudgeLine} />
            <Text style={styles.nudgeText}>
              {totalCount - completedCount} left — finish strong.
            </Text>
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Confetti (per task) ─────────────────────────────────────────────── */}
      <Confetti visible={confettiVisible} onComplete={() => setConfettiVisible(false)} />

      {/* ── Trophy popup ────────────────────────────────────────────────────── */}
      {trophyVisible && (
        <Animated.View
          style={[styles.trophyOverlay, {
            opacity:   trophyAnim,
            transform: [{ scale: trophyAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          }]}
          pointerEvents="none"
        >
          <View style={styles.trophyGradient}>
            <Ionicons name="trophy" size={52} color={Colors.primary} style={styles.trophyIcon} />
            <Text style={styles.trophyTitle}>Day Complete!</Text>
            <Text style={styles.trophySub}>
              All {totalCount} tasks done. Day {appState.streak + 1} locked in.
            </Text>
            <Text style={styles.trophyMotivation}>There is no tomorrow — you owned today.</Text>
          </View>
        </Animated.View>
      )}

      {/* ── Add Task Modal ───────────────────────────────────────────────────── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowAddModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowAddModal(false); }}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKAV}
          pointerEvents="box-none"
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Task</Text>

            <Text style={styles.fieldLabel}>Task Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder="What are you studying?"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <DurationSlider value={newTaskDuration} onChange={setNewTaskDuration} />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              <View style={styles.categoryRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, newTaskCategory === cat && styles.catChipSelected]}
                    onPress={() => { setNewTaskCategory(cat); buttonPress(); }}
                  >
                    <Text style={[styles.catChipText, newTaskCategory === cat && { color: Colors.primary }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Repeat toggle */}
            <TouchableOpacity
              style={styles.repeatRow}
              onPress={() => { setNewTaskRepeat(r => !r); buttonPress(); }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.repeatLabel}>Repeat daily</Text>
                <Text style={styles.repeatSub}>Add this task every day automatically</Text>
              </View>
              <View style={[styles.toggle, newTaskRepeat && styles.toggleOn]}>
                <View style={[styles.toggleThumb, newTaskRepeat && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddModal(false); Keyboard.dismiss(); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, !newTaskTitle.trim() && styles.createBtnDisabled]}
                onPress={handleAddTask}
                disabled={!newTaskTitle.trim()}
              >
                <View style={styles.createBtnGradient}>
                  <Text style={styles.createText}>Add Task</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Duration Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={!!editingTask}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setEditingTask(null)}
      >
        <TouchableWithoutFeedback onPress={() => setEditingTask(null)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.modalKAV} pointerEvents="box-none">
          <View style={styles.modalSheetSmall}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Duration</Text>
            {editingTask && (
              <Text style={styles.editTaskName} numberOfLines={2}>{editingTask.title}</Text>
            )}
            <DurationSlider value={editDuration} onChange={setEditDuration} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingTask(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleSaveDuration}>
                <View style={styles.createBtnGradient}>
                  <Text style={styles.createText}>Save</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    paddingTop: 56,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tagline: {
    fontFamily: Fonts.display, fontSize: 20, color: Colors.gray[300],
    letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 24,
  },

  pillRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, marginBottom: Spacing.xl },
  pillCol: { alignItems: 'center', gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: BorderRadius.full,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  pillVal: { fontFamily: Fonts.retro, fontSize: 16 },
  pillLabel: { fontSize: 11, color: Colors.textSecondary, fontFamily: Fonts.regular },
  progressSection: { gap: 6 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { ...Typography.labelSmall, color: Colors.textSecondary },
  progressCount: { ...Typography.labelLarge, fontFamily: Fonts.bold },
  progressTrack: { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: {
    height: '100%', borderRadius: 3,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6,
  },

  // Scroll / list
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  heroFlame: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  listTitle: { ...Typography.headlineSmall, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  countdownStack: { gap: Spacing.sm, marginBottom: Spacing.sm },
  blob: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  blobTodo: { backgroundColor: Colors.gray[800], borderWidth: 1, borderColor: Colors.gray[700] },
  blobDone: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.green.deep },
  blobLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, paddingLeft: 2 },
  blobLabelTodo: { color: Colors.gray[300] },
  blobLabelDone: { color: Colors.green.light },
  blobEmpty: { ...Typography.bodySmall, color: Colors.textMuted, paddingVertical: Spacing.sm },

  addBtn: { borderRadius: BorderRadius.sm, overflow: 'hidden' },
  addBtnGradient: { paddingHorizontal: Spacing.md, paddingVertical: 8, backgroundColor: Colors.textPrimary },
  addBtnText: { fontFamily: Fonts.retro, fontSize: 16, color: Colors.background, letterSpacing: 0.5 },
  backTodayBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backTodayText: { ...Typography.labelSmall, color: Colors.textSecondary },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.sm },
  emptyTitle: { ...Typography.headlineMedium, color: Colors.textPrimary },
  emptyDesc:  { ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center' },

  nudge: { alignItems: 'center', marginVertical: Spacing.md, gap: Spacing.sm },
  nudgeLine: { width: 40, height: 1, backgroundColor: Colors.accent + '55' },
  nudgeText: { ...Typography.bodySmall, color: Colors.accent, textAlign: 'center', fontStyle: 'italic' },

  // Trophy
  trophyOverlay: {
    position: 'absolute',
    bottom: 110,
    left: Spacing.xl,
    right: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 14,
  },
  trophyGradient: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceElevated,
  },
  trophyIcon:       { marginBottom: 4 },
  trophyTitle:      { fontSize: 26, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: -0.5 },
  trophySub:        { ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center' },
  trophyMotivation: { ...Typography.labelSmall, color: Colors.accent, textAlign: 'center', marginTop: 4, letterSpacing: 0.5 },

  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalKAV: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: 44,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
  },
  modalSheetSmall: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: 44,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
  },
  modalHandle: {
    width: 36, height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { ...Typography.headlineLarge, color: Colors.textPrimary, marginBottom: Spacing.md },
  editTaskName: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: Spacing.md },
  fieldLabel: { ...Typography.labelSmall, color: Colors.textSecondary, marginBottom: 6 },
  modalInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: Fonts.regular,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  categoryRow: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.xl },
  catChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  catChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  catChipText: { ...Typography.labelSmall, color: Colors.textSecondary },

  // Repeat toggle
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  repeatLabel: { ...Typography.labelLarge, color: Colors.textPrimary },
  repeatSub:   { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  toggle: {
    width: 44, height: 26,
    borderRadius: 13,
    backgroundColor: Colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // Modal buttons
  modalButtons: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelText:   { ...Typography.headlineSmall, color: Colors.textSecondary, fontSize: 15 },
  createBtn:    { flex: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  createBtnDisabled: { opacity: 0.4 },
  createBtnGradient: { paddingVertical: Spacing.md, alignItems: 'center', backgroundColor: Colors.primary },
  createText:   { ...Typography.headlineSmall, color: '#000', fontSize: 15 },
});
