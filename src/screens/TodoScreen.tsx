import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { Task, EXAM_PRESETS, ExamType } from '../data/examPresets';
import { StorageService, AppState } from '../utils/storage';
import { TaskItem } from '../components/TaskItem';
import { StreakFlame } from '../components/StreakFlame';
import { useHaptics } from '../hooks/useHaptics';

const { width: W, height: H } = Dimensions.get('window');

const CATEGORIES = [
  'Study', 'Practice', 'Revision', 'Reading', 'Writing', 'Physics',
  'Chemistry', 'Mathematics', 'Biology', 'Other'
];

interface Props {
  appState: AppState;
  onStateChange: (s: AppState) => void;
}

export const TodoScreen: React.FC<Props> = ({ appState, onStateChange }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('60');
  const [newTaskCategory, setNewTaskCategory] = useState('Study');
  const [celebrateVisible, setCelebrateVisible] = useState(false);

  const celebrateAnim = useRef(new Animated.Value(0)).current;
  const completionPulse = useRef(new Animated.Value(1)).current;
  const headerGlow = useRef(new Animated.Value(0)).current;
  const { taskComplete, allComplete, buttonPress } = useHaptics();

  const user = appState.user;
  const examType = (user?.examType as ExamType) ?? 'CUSTOM';

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Late night grind';
  };

  // Load today's tasks
  useEffect(() => {
    const load = async () => {
      const saved = await StorageService.getTodayTasks();
      if (saved) {
        setTasks(saved);
      } else {
        const preset = EXAM_PRESETS[examType] ?? EXAM_PRESETS.CUSTOM;
        const fresh = preset.map(t => ({ ...t, completed: false }));
        setTasks(fresh);
        await StorageService.saveTodayTasks(fresh);
      }
    };
    load();
  }, []);

  // Animate header glow on progress
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  useEffect(() => {
    Animated.timing(headerGlow, { toValue: progress, duration: 500, useNativeDriver: false }).start();
  }, [progress]);

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
      Animated.sequence([
        Animated.timing(completionPulse, { toValue: 1.04, duration: 100, useNativeDriver: true }),
        Animated.timing(completionPulse, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();

      // Check if all done
      const newCompleted = updated.filter(t => t.completed).length;
      if (newCompleted === updated.length && updated.length > 0) {
        setTimeout(() => triggerCelebration(updated), 400);
      }
    }

    const newState = await StorageService.recordDayCompletion(updated);
    onStateChange(newState);
  }, [tasks]);

  const triggerCelebration = async (finalTasks: Task[]) => {
    await allComplete();
    setCelebrateVisible(true);
    Animated.sequence([
      Animated.spring(celebrateAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(celebrateAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setCelebrateVisible(false));
  };

  const handleDeleteTask = useCallback(async (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    await StorageService.saveTodayTasks(updated);
    buttonPress();
  }, [tasks]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    const id = `custom-${Date.now()}`;
    const newTask: Task = {
      id,
      title: newTaskTitle.trim(),
      duration: parseInt(newTaskDuration) || 60,
      category: newTaskCategory,
      isCustom: true,
      completed: false,
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    await StorageService.saveTodayTasks(updated);
    setNewTaskTitle('');
    setNewTaskDuration('60');
    setNewTaskCategory('Study');
    setShowAddModal(false);
    buttonPress();
  };

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const progressColor = progress >= 1 ? Colors.success : progress >= 0.5 ? Colors.primary : Colors.accent;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0A0015', '#080810']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <Animated.View style={[styles.header, { borderBottomColor: headerGlow.interpolate({ inputRange: [0, 1], outputRange: [Colors.border, Colors.primary + '55'] }) }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.name ?? 'Champion'} 👊</Text>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
          <StreakFlame streak={appState.streak} size="sm" />
        </View>

        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Today's Progress</Text>
            <Text style={[styles.progressCount, { color: progressColor }]}>
              {completedCount}/{totalCount} tasks
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%` as any,
                  backgroundColor: progressColor,
                  shadowColor: progressColor,
                },
              ]}
            />
          </View>
          {progress > 0 && progress < 1 && (
            <Text style={styles.progressPercent}>{Math.round(progress * 100)}% done</Text>
          )}
          {progress >= 1 && (
            <Text style={[styles.progressPercent, { color: Colors.success }]}>🎉 All done! You killed it today.</Text>
          )}
        </View>
      </Animated.View>

      {/* Task list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            {examType !== 'CUSTOM' ? `${examType} Study Plan` : 'Your Study Plan'}
          </Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { setShowAddModal(true); buttonPress(); }}
            activeOpacity={0.7}
          >
            <LinearGradient colors={['#9B5CF6', '#7C3AED']} style={styles.addBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.addBtnText}>+ Add Task</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptyDesc}>Tap "Add Task" to build your study plan for today.</Text>
          </View>
        ) : (
          tasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onDelete={task.isCustom ? handleDeleteTask : undefined}
              index={index}
            />
          ))
        )}

        {completedCount > 0 && completedCount < totalCount && (
          <View style={styles.realityCheck}>
            <View style={styles.realityLine} />
            <Text style={styles.realityText}>
              {totalCount - completedCount} task{totalCount - completedCount > 1 ? 's' : ''} left. Finish strong — no compromises.
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Task Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
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
              autoFocus
            />

            <Text style={styles.fieldLabel}>Duration (minutes)</Text>
            <TextInput
              style={styles.modalInput}
              value={newTaskDuration}
              onChangeText={setNewTaskDuration}
              keyboardType="numeric"
              placeholder="60"
              placeholderTextColor={Colors.textMuted}
            />

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

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
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
        </View>
      </Modal>

      {/* Celebration overlay */}
      {celebrateVisible && (
        <Animated.View
          style={[
            styles.celebrationOverlay,
            {
              opacity: celebrateAnim,
              transform: [{ scale: celebrateAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
            },
          ]}
          pointerEvents="none"
        >
          <LinearGradient colors={['#7C3AED22', '#10B98122']} style={styles.celebrationGradient}>
            <Text style={styles.celebrationEmoji}>🏆</Text>
            <Text style={styles.celebrationTitle}>You did it!</Text>
            <Text style={styles.celebrationSub}>All tasks complete. Day {appState.streak} locked in.</Text>
          </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 56,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  date: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: 2,
  },
  progressSection: { gap: Spacing.xs },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: { ...Typography.labelSmall, color: Colors.textSecondary },
  progressCount: { ...Typography.labelLarge, fontWeight: '700' },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  progressPercent: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'right' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  listTitle: { ...Typography.headlineSmall, color: Colors.textPrimary },
  addBtn: { borderRadius: BorderRadius.sm, overflow: 'hidden' },
  addBtnGradient: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
  addBtnText: { ...Typography.labelLarge, color: '#fff', fontSize: 13 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { ...Typography.headlineMedium, color: Colors.textPrimary },
  emptyDesc: { ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center' },
  realityCheck: {
    alignItems: 'center',
    marginVertical: Spacing.md,
    gap: Spacing.sm,
  },
  realityLine: {
    width: 40,
    height: 1,
    backgroundColor: Colors.accent + '55',
  },
  realityText: {
    ...Typography.bodySmall,
    color: Colors.accent,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  modalHandle: {
    width: 36,
    height: 4,
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
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  categoryRow: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.xl },
  catChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  catChipText: { ...Typography.labelSmall, color: Colors.textSecondary },
  modalButtons: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: { ...Typography.headlineSmall, color: Colors.textSecondary, fontSize: 15 },
  createBtn: { flex: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  createBtnDisabled: { opacity: 0.4 },
  createBtnGradient: { paddingVertical: Spacing.md, alignItems: 'center' },
  createText: { ...Typography.headlineSmall, color: '#fff', fontSize: 15 },
  celebrationOverlay: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.xl,
    right: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  celebrationGradient: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    borderRadius: BorderRadius.xl,
  },
  celebrationEmoji: { fontSize: 48 },
  celebrationTitle: { ...Typography.headlineLarge, color: Colors.textPrimary },
  celebrationSub: { ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center' },
});
