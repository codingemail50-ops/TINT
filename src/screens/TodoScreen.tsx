import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Modal, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { Task, getCombinedPreset, ExamType } from '../data/examPresets';
import { StorageService, AppState } from '../utils/storage';
import { TaskItem } from '../components/TaskItem';
import { FlameBadge } from '../components/FlameBadge';
import { PixelFlame } from '../components/PixelFlame';
import { Bonfire } from '../components/Bonfire';
import { Confetti } from '../components/Confetti';
import { FocusScreen } from './FocusScreen';
import { UCEEDCountdown, NIDCountdown, NIFTCountdown } from '../components/ExamCountdowns';
import { useHaptics } from '../hooks/useHaptics';
import { syncFocusLog } from '../utils/supabaseStorage';
import { FocusLogEntry, loadFocusLog, saveFocusLog, computeFocusStats, subscribeFocusLog } from '../utils/focusLog';
import { DistractionLogEntry, loadDistractionLog, computeDistractedToday, subscribeDistractionLog } from '../utils/distractionLog';
import { loadActiveSession } from '../utils/activeFocusSession';
import { now as devNow, subscribeDevClock } from '../utils/devClock';
import { useFocusSessionStatus } from '../context/FocusSessionContext';

const CATEGORIES = [
  'Study', 'Practice', 'Revision', 'Reading', 'Writing',
  'Drawing', 'Design', 'Mathematics', 'Physics', 'Chemistry', 'Other',
];

function formatHrsMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

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

// ── Main Screen ───────────────────────────────────────────────────────────────
interface Props {
  appState: AppState;
  onStateChange: (s: AppState) => void;
  userId?: string;
  onNavigateFocus: () => void;
  onNavigateProfile: () => void;
  onNavigateAnalytics: () => void;
}

export const TodoScreen: React.FC<Props> = ({ appState, onStateChange, userId, onNavigateFocus, onNavigateProfile, onNavigateAnalytics }) => {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [todayStr, setTodayStr]     = useState(() => devNow().toDateString());
  const [selectedDate, setSelectedDate] = useState(() => devNow().toDateString());
  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([]);
  const [distractionLog, setDistractionLog] = useState<DistractionLogEntry[]>([]);

  // Tapping an incomplete task pops up the Focus screen (same squiggly-circle
  // UI as the Focus tab) pre-loaded with that task and running — this just
  // tracks which task, if any, is currently running that way.
  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  // Whether that overlay's full UI is showing right now, vs minimized back
  // to this task list while the session keeps running underneath (it stays
  // mounted either way, just hidden — see the `visible` prop below).
  const [taskOverlayVisible, setTaskOverlayVisible] = useState(true);
  const { expandSignal } = useFocusSessionStatus();

  // A brand-new task session always opens full-screen.
  useEffect(() => { if (timerTaskId) setTaskOverlayVisible(true); }, [timerTaskId]);
  // Tapping the mini-player while minimized re-expands it (navigating to
  // 'todo' alone wouldn't signal anything, since it's already the screen
  // that's on screen).
  useEffect(() => { if (timerTaskId) setTaskOverlayVisible(true); }, [expandSignal]);

  // Add task modal
  const [showAddModal, setShowAddModal]     = useState(false);
  const [newTaskTitle, setNewTaskTitle]     = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [newTaskCategory, setNewTaskCategory] = useState('Study');
  const [newTaskRepeat, setNewTaskRepeat]   = useState(false);
  const [newTaskPriority, setNewTaskPriority] = useState(false);

  // Edit task modal (long press) — title, duration, priority
  const [editingTask, setEditingTask]     = useState<Task | null>(null);
  const [editTitle, setEditTitle]         = useState('');
  const [editDuration, setEditDuration]   = useState(60);
  const [editPriority, setEditPriority]   = useState(false);

  // Celebration
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [trophyVisible, setTrophyVisible]   = useState(false);
  const trophyAnim = useRef(new Animated.Value(0)).current;

  const headerGlow = useRef(new Animated.Value(0)).current;
  const { taskComplete, allComplete, buttonPress } = useHaptics();

  const user        = appState.user;
  const examTypes   = (user?.examTypes ?? []) as ExamType[];

  // Load today's tasks — a custom exam (from "Other") seeds the day the same
  // way a preset does, just from user-typed tasks instead of BASE_TASKS.
  // Pulled out to a named function so it can also re-run when the dev-mode
  // day-skip tool advances the clock (see devClock.ts) — screens stay
  // mounted across tab switches now, so nothing else would trigger a refetch.
  const refreshDay = useCallback(async () => {
    let loadedTasks: Task[];
    const saved = await StorageService.getTodayTasks();
    if (saved) {
      loadedTasks = saved;
    } else {
      loadedTasks = user?.customExam
        ? user.customExam.tasks.map((t, i) => ({
            id: `custom-${i}`, title: t.title, duration: t.duration,
            category: user.customExam!.name, completed: false,
          }))
        : getCombinedPreset(examTypes).map(t => ({ ...t, completed: false }));
      await StorageService.saveTodayTasks(loadedTasks);
    }
    setTasks(loadedTasks);

    // A task-linked session was still running when the app process got
    // killed — re-open its overlay so FocusScreen's own boot-resume logic
    // (see activeFocusSession.ts) can pick the timing back up.
    const active = await loadActiveSession();
    if (active?.source === 'task' && active.taskId) {
      const stillPending = loadedTasks.find(t => t.id === active.taskId && !t.completed);
      if (stillPending) setTimerTaskId(active.taskId);
    }

    setFocusLog(await loadFocusLog());
    setDistractionLog(await loadDistractionLog());
  }, [user, examTypes]);

  useEffect(() => { void refreshDay(); }, []);

  useEffect(() => subscribeDevClock(() => {
    const newToday = devNow().toDateString();
    setSelectedDate(prev => (prev === todayStr ? newToday : prev));
    setTodayStr(newToday);
    void refreshDay();
  }), [todayStr, refreshDay]);

  // The Focus tab stays mounted alongside Today now, and logs sessions of
  // its own — without this, a standalone (non-task-linked) session
  // completed there would show up in Insights (which reloads every visit)
  // but never update Today's Focused/Distracted pills or bonfire progress.
  useEffect(() => subscribeFocusLog(() => { loadFocusLog().then(setFocusLog); }), []);
  useEffect(() => subscribeDistractionLog(() => { loadDistractionLog().then(setDistractionLog); }), []);

  const viewingPast = selectedDate !== todayStr;
  const pastRecord  = viewingPast
    ? appState.history.find(h => h.date === selectedDate)
    : null;
  const displayTasks = viewingPast ? (pastRecord?.tasks ?? []) : tasks;
  const priorityGroup = displayTasks.filter(t => !t.completed && t.id !== timerTaskId && t.priority === 'high');
  const todoGroup = displayTasks.filter(t => !t.completed && t.id !== timerTaskId && t.priority !== 'high');
  const doneGroup = displayTasks.filter(t => t.completed);
  const focusTodayExact = computeFocusStats(focusLog).today;
  const focusToday = Math.round(focusTodayExact);
  const distractedToday = Math.round(computeDistractedToday(distractionLog));

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
      t.id === id ? { ...t, completed, completedAt: completed ? devNow().toISOString() : undefined } : t
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
    if (mins <= 0) return;
    const log = await loadFocusLog();
    const updatedLog = [...log, { date: devNow().toDateString(), mins, timestamp: devNow().toISOString() }];
    await saveFocusLog(updatedLog);
    setFocusLog(updatedLog);
    if (userId) void syncFocusLog(userId, updatedLog);
  };

  // Natural completion of a task-linked Focus session — mark the task done
  // and log the focus minutes. The overlay stays open (showing "Session
  // Complete!") until the user actually leaves it, which fires
  // handleTaskSessionExit below — that's what clears timerTaskId.
  const handleTaskSessionFinish = (actualSeconds: number) => {
    if (!timerTaskId) return;
    void applyCompletion(timerTaskId, true);
    void logFocusMinutes(actualSeconds / 60);
  };

  // Leaving a task-linked Focus session: early abandon (task stays
  // incomplete, but whatever time actually ran gets banked) or dismissing
  // the "session complete" screen after a natural finish (already logged
  // by handleTaskSessionFinish, so wasNaturalCompletion skips re-logging).
  const handleTaskSessionExit = (actualSeconds: number, wasNaturalCompletion: boolean) => {
    buttonPress();
    if (!wasNaturalCompletion && actualSeconds > 0) {
      void logFocusMinutes(actualSeconds / 60);
    }
    setTimerTaskId(null);
  };

  const handleTaskPress = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.completed) {
      void applyCompletion(id, false);
      return;
    }
    if (timerTaskId && timerTaskId !== id) return; // one focus session at a time
    buttonPress();
    setTimerTaskId(id);
  }, [tasks, timerTaskId, applyCompletion]);

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

  // ── Toggle High Priority (double-tap, or drag between To Do / High Priority) ──
  const handleTogglePriority = useCallback(async (id: string) => {
    const updated = tasks.map(t => (t.id === id ? { ...t, priority: t.priority === 'high' ? undefined : 'high' as const } : t));
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
      priority: newTaskPriority ? 'high' : undefined,
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    await StorageService.saveTodayTasks(updated);
    setNewTaskTitle('');
    setNewTaskDuration(60);
    setNewTaskCategory('Study');
    setNewTaskRepeat(false);
    setNewTaskPriority(false);
    setShowAddModal(false);
    buttonPress();
  };

  // ── Edit task (long press) ────────────────────────────────────────────────────
  const handleLongPress = (id: string) => {
    if (id === timerTaskId) return; // locked in once a timer is running
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDuration(task.duration);
    setEditPriority(task.priority === 'high');
    buttonPress();
  };

  const handleSaveTaskEdit = async () => {
    if (!editingTask || !editTitle.trim()) return;
    const updated = tasks.map(t =>
      t.id === editingTask.id
        ? { ...t, title: editTitle.trim(), duration: editDuration, priority: editPriority ? ('high' as const) : undefined }
        : t
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
          <FlameBadge streak={appState.streak} size={46} onPress={onNavigateProfile} avatar={appState.user?.avatar} />
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
            {/* Fire — the hero, like Opal's crystal. Grows through discrete
                stages with today's focus progress; color tier escalates
                with streak. */}
            <TouchableOpacity style={styles.heroFlame} onPress={onNavigateFocus} activeOpacity={0.85}>
              <Bonfire
                progress={focusToday / (appState.user?.dailyFocusGoalMins || 60)}
                streak={appState.streak}
                maxHeight={175}
              />
            </TouchableOpacity>

            {/* Focused / Distracted stats row — Focused pill leads to
                Analytics. Distracted is honest, not simulated: time the
                app was backgrounded during an active focus session (see
                distractionLog.ts) — not real per-app usage, which needs a
                native build we don't have. */}
            <View style={styles.pillRow}>
              <TouchableOpacity style={styles.pillCol} onPress={onNavigateAnalytics} activeOpacity={0.75}>
                <View style={styles.pill}>
                  <Text style={styles.pillVal}>{formatHrsMins(focusToday)}</Text>
                </View>
                <Text style={styles.pillLabel}>Focused</Text>
              </TouchableOpacity>
              <View style={styles.pillCol}>
                <View style={styles.pill}>
                  <Text style={styles.pillVal}>{formatHrsMins(distractedToday)}</Text>
                </View>
                <Text style={styles.pillLabel}>Distracted</Text>
              </View>
            </View>

            {/* Exam countdown, right under the pills — leads to Analytics */}
            {examTypes.length > 0 && (
              <TouchableOpacity style={styles.countdownStack} onPress={onNavigateAnalytics} activeOpacity={0.85}>
                <UCEEDCountdown examTypes={examTypes} />
                <NIDCountdown examTypes={examTypes} />
                <NIFTCountdown examTypes={examTypes} />
              </TouchableOpacity>
            )}
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
            <View style={[styles.blob, styles.blobPriority]}>
              <Text style={[styles.blobLabel, styles.blobLabelPriority]}>High priority</Text>
              {priorityGroup.length === 0 ? (
                <Text style={[styles.blobEmpty, styles.blobEmptyPriority]}>
                  Drag a task up here, or double-tap one, to prioritize it.
                </Text>
              ) : (
                priorityGroup.map((task, index) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={handleTaskPress}
                    onDelete={task.isCustom ? handleDelete : undefined}
                    onLongPress={handleLongPress}
                    onTogglePriority={handleTogglePriority}
                    index={index}
                    variant="priority"
                  />
                ))
              )}
            </View>

            <View style={[styles.blob, styles.blobTodo]}>
              <Text style={[styles.blobLabel, styles.blobLabelTodo]}>To do</Text>
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
                    onTogglePriority={handleTogglePriority}
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
                    variant="done"
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

      {/* ── Task-linked Focus session — full-screen overlay, same UI as the
           Focus tab, just pre-loaded with a task and auto-started ────────── */}
      {timerTaskId && tasks.find(t => t.id === timerTaskId) && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents={taskOverlayVisible ? 'auto' : 'none'}>
          <FocusScreen
            userId={userId}
            externalTask={{
              title: tasks.find(t => t.id === timerTaskId)!.title,
              durationMins: tasks.find(t => t.id === timerTaskId)!.duration,
              id: timerTaskId,
            }}
            sessionSource="task"
            visible={taskOverlayVisible}
            onMinimize={() => setTaskOverlayVisible(false)}
            onExternalFinish={handleTaskSessionFinish}
            onExternalExit={handleTaskSessionExit}
          />
        </View>
      )}

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

            {/* High priority toggle */}
            <TouchableOpacity
              style={styles.repeatRow}
              onPress={() => { setNewTaskPriority(p => !p); buttonPress(); }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.repeatLabel}>High priority</Text>
                <Text style={styles.repeatSub}>Pin it above the rest of today's list</Text>
              </View>
              <View style={[styles.toggle, newTaskPriority && styles.togglePriorityOn]}>
                <View style={[styles.toggleThumb, newTaskPriority && styles.toggleThumbOn]} />
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

      {/* ── Edit Task Modal ──────────────────────────────────────────────────── */}
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
            <Text style={styles.modalTitle}>Edit Task</Text>
            <TextInput
              style={styles.modalInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Task title"
              placeholderTextColor={Colors.textMuted}
            />
            <DurationSlider value={editDuration} onChange={setEditDuration} />
            <TouchableOpacity
              style={styles.repeatRow}
              onPress={() => setEditPriority(p => !p)}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.repeatLabel}>High priority</Text>
                <Text style={styles.repeatSub}>Pin it above the rest of today's list</Text>
              </View>
              <View style={[styles.toggle, editPriority && styles.togglePriorityOn]}>
                <View style={[styles.toggleThumb, editPriority && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingTask(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, !editTitle.trim() && styles.createBtnDisabled]}
                onPress={handleSaveTaskEdit}
                disabled={!editTitle.trim()}
              >
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
    paddingTop: 48,
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
    fontFamily: Fonts.pixel, fontSize: 22, color: Colors.pop,
    letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 22,
  },

  pillRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, marginTop: 25, marginBottom: 30 },
  pillCol: { alignItems: 'center', gap: 6 },
  pill: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 22, paddingVertical: 9,
    minWidth: 96, alignItems: 'center',
  },
  pillVal: { fontFamily: Fonts.retro, fontSize: 16, color: Colors.background },
  pillLabel: { fontSize: 11, color: Colors.textSecondary, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
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
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  heroFlame: { alignItems: 'center', justifyContent: 'center', paddingTop: 79, paddingBottom: 0 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 24,
  },
  listTitle: { ...Typography.headlineSmall, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  countdownStack: { gap: Spacing.sm, marginBottom: 24 },
  blob: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  blobPriority: { backgroundColor: Colors.pop },
  blobTodo: { backgroundColor: Colors.gray[800], borderWidth: 1, borderColor: Colors.gray[700] },
  blobDone: { backgroundColor: Colors.primary },
  blobLabel: { fontSize: 20, fontFamily: Fonts.pixel, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, paddingLeft: 2 },
  blobLabelPriority: { color: Colors.background },
  blobLabelTodo: { color: Colors.gray[300] },
  blobLabelDone: { color: Colors.background },
  blobEmpty: { ...Typography.bodySmall, color: Colors.textMuted, paddingVertical: Spacing.sm },
  blobEmptyPriority: { color: Colors.background, opacity: 0.75 },

  addBtn: { borderRadius: BorderRadius.sm, overflow: 'hidden' },
  addBtnGradient: { paddingHorizontal: Spacing.sm, paddingVertical: 5, backgroundColor: Colors.textPrimary },
  addBtnText: { fontFamily: Fonts.retro, fontSize: 13, color: Colors.background, letterSpacing: 0.5 },
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
  togglePriorityOn: { backgroundColor: Colors.pop },
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
