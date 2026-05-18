import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Modal, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { Task, getCombinedPreset, ExamType } from '../data/examPresets';
import { StorageService, AppState } from '../utils/storage';
import { TaskItem } from '../components/TaskItem';
import { FlameIcon } from '../components/FlameIcon';
import { Confetti } from '../components/Confetti';
import { useHaptics } from '../hooks/useHaptics';

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
  valueText: { ...Typography.labelLarge, color: Colors.primary, fontWeight: '700' },
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
}

const todayStr = new Date().toDateString();

function buildDateStrip(history: AppState['history']) {
  const items: { dateStr: string; dayLetter: string; dayNum: number; isToday: boolean; consistency: number }[] = [];
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (let i = 14; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    const record  = history.find(h => h.date === dateStr);
    items.push({
      dateStr,
      dayLetter: DAYS[d.getDay()],
      dayNum: d.getDate(),
      isToday: i === 0,
      consistency: record?.consistency ?? -1,
    });
  }
  return items;
}

export const TodoScreen: React.FC<Props> = ({ appState, onStateChange }) => {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr);

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
  const examLabel   = examTypes.length > 0 ? examTypes.join(' + ') : 'Your';

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Late night grind';
  };

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
  }, []);

  const viewingPast = selectedDate !== todayStr;
  const pastRecord  = viewingPast
    ? appState.history.find(h => h.date === selectedDate)
    : null;
  const displayTasks = viewingPast ? (pastRecord?.tasks ?? []) : tasks;

  const completedCount = displayTasks.filter(t => t.completed).length;
  const totalCount     = displayTasks.length;
  const progress       = totalCount > 0 ? completedCount / totalCount : 0;

  // Today's values for FlameIcon
  const todayConsistency = tasks.length > 0
    ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
    : 0;

  useEffect(() => {
    if (!viewingPast) {
      Animated.timing(headerGlow, { toValue: progress, duration: 500, useNativeDriver: false }).start();
    }
  }, [progress, viewingPast]);

  const dateStrip = useMemo(() => buildDateStrip(appState.history), [appState.history, tasks]);

  const dateScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    // Scroll to today on mount
    setTimeout(() => dateScrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, []);

  // ── Task toggle ──────────────────────────────────────────────────────────────
  const handleToggle = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const wasCompleted = task.completed;
    const updated = tasks.map(t =>
      t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined } : t
    );
    setTasks(updated);
    await StorageService.saveTodayTasks(updated);

    if (!wasCompleted) {
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
      <LinearGradient colors={['#0A0015', '#080810']} style={StyleSheet.absoluteFill} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.header, {
        borderBottomColor: headerGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [Colors.border, Colors.primary + '55'],
        }),
      }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.name ?? 'Champion'} 👊</Text>
          </View>
          <FlameIcon streak={appState.streak} consistency={todayConsistency} size={52} />
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              {viewingPast ? selectedDate : "Today's Progress"}
            </Text>
            <Text style={[styles.progressCount, { color: progressColor }]}>
              {completedCount}/{totalCount}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, {
              width: `${progress * 100}%` as any,
              backgroundColor: progressColor,
              shadowColor: progressColor,
            }]} />
          </View>
        </View>
      </Animated.View>

      {/* ── Date Strip ─────────────────────────────────────────────────────── */}
      <View style={styles.dateStripWrapper}>
        <ScrollView
          ref={dateScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStrip}
        >
          {dateStrip.map(item => {
            const isSelected = selectedDate === item.dateStr;
            const hasData    = item.consistency >= 0;
            const dotColor   = item.consistency >= 80 ? Colors.success
              : item.consistency >= 50 ? Colors.accent
              : item.consistency >= 0  ? Colors.danger
              : 'transparent';

            return (
              <TouchableOpacity
                key={item.dateStr}
                style={[styles.dateCell, isSelected && styles.dateCellSelected]}
                onPress={() => setSelectedDate(item.dateStr)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateDayLetter, isSelected && styles.dateCellTextActive]}>
                  {item.dayLetter}
                </Text>
                <Text style={[styles.dateDayNum, isSelected && styles.dateCellTextActive]}>
                  {item.dayNum}
                </Text>
                {hasData && !item.isToday && (
                  <View style={[styles.dateDot, { backgroundColor: dotColor }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Task list ──────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.listHeader}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {viewingPast ? 'Past tasks' : `${examLabel} Plan`}
          </Text>
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
              <LinearGradient colors={['#9B5CF6', '#7C3AED']} style={styles.addBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.addBtnText}>+ Add Task</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {!viewingPast && (
          <Text style={styles.longPressHint}>Long-press any task to edit its duration</Text>
        )}

        {displayTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{viewingPast ? '📅' : '📋'}</Text>
            <Text style={styles.emptyTitle}>
              {viewingPast ? 'No tasks recorded' : 'No tasks yet'}
            </Text>
            <Text style={styles.emptyDesc}>
              {viewingPast
                ? 'No study session was recorded for this day.'
                : 'Tap "+ Add Task" to build your study plan.'}
            </Text>
          </View>
        ) : (
          displayTasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={viewingPast ? undefined : handleToggle}
              onDelete={(!viewingPast && task.isCustom) ? handleDelete : undefined}
              onLongPress={viewingPast ? undefined : handleLongPress}
              readOnly={viewingPast}
              index={index}
            />
          ))
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
          <LinearGradient
            colors={['#7C3AED44', '#10B98133']}
            style={styles.trophyGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.trophyEmoji}>🏆</Text>
            <Text style={styles.trophyTitle}>Day Complete!</Text>
            <Text style={styles.trophySub}>
              All {totalCount} tasks done. Day {appState.streak + 1} locked in.
            </Text>
            <Text style={styles.trophyMotivation}>There is no tomorrow — you owned today.</Text>
          </LinearGradient>
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
            <LinearGradient colors={[Colors.surfaceElevated, Colors.surface]} style={StyleSheet.absoluteFill} />
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
                <LinearGradient colors={['#9B5CF6', '#7C3AED']} style={styles.createBtnGradient}>
                  <Text style={styles.createText}>Add Task</Text>
                </LinearGradient>
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
            <LinearGradient colors={[Colors.surfaceElevated, Colors.surface]} style={StyleSheet.absoluteFill} />
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
                <LinearGradient colors={['#9B5CF6', '#7C3AED']} style={styles.createBtnGradient}>
                  <Text style={styles.createText}>Save</Text>
                </LinearGradient>
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
  greeting: { ...Typography.bodyMedium, color: Colors.textSecondary },
  userName:  { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  progressSection: { gap: 6 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { ...Typography.labelSmall, color: Colors.textSecondary },
  progressCount: { ...Typography.labelLarge, fontWeight: '700' },
  progressTrack: { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: {
    height: '100%', borderRadius: 3,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6,
  },

  // Date strip
  dateStripWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  dateStrip: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 6,
  },
  dateCell: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    minWidth: 36,
    gap: 2,
  },
  dateCellSelected: {
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  dateDayLetter: { ...Typography.labelSmall, color: Colors.textMuted, fontSize: 10 },
  dateDayNum: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  dateCellTextActive: { color: Colors.primaryLight },
  dateDot: { width: 5, height: 5, borderRadius: 3 },

  // Scroll / list
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listTitle: { ...Typography.headlineSmall, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  longPressHint: { ...Typography.bodySmall, color: Colors.textMuted, marginBottom: Spacing.md },
  addBtn: { borderRadius: BorderRadius.sm, overflow: 'hidden' },
  addBtnGradient: { paddingHorizontal: Spacing.md, paddingVertical: 8 },
  addBtnText: { ...Typography.labelLarge, color: '#fff', fontSize: 13 },
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
  emptyEmoji: { fontSize: 48 },
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
    borderColor: Colors.primary + '66',
    borderRadius: BorderRadius.xl,
  },
  trophyEmoji:      { fontSize: 52 },
  trophyTitle:      { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
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
  },
  modalSheetSmall: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: 44,
    overflow: 'hidden',
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
  createBtnGradient: { paddingVertical: Spacing.md, alignItems: 'center' },
  createText:   { ...Typography.headlineSmall, color: '#fff', fontSize: 15 },
});
