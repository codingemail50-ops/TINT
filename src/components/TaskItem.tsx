import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS,
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { Task } from '../data/examPresets';

const SCREEN_W = Dimensions.get('window').width;
const DELETE_THRESHOLD = SCREEN_W * 0.32;
const PRIORITY_DRAG_THRESHOLD = 56;

interface Props {
  task: Task;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onLongPress?: (id: string) => void;
  /** Double-tap, or a vertical drag past the threshold, toggles this —
   *  same underlying action (Task.priority), two gestures. Omitted for
   *  Done tasks — priority is a To Do / High Priority concept only. */
  onTogglePriority?: (id: string) => void;
  readOnly?: boolean;
  index: number;
  /** 'priority' sits on the orange High Priority panel — inner card goes
   *  near-black for contrast. 'done' sits on the white Done panel. */
  variant?: 'priority' | 'done';
}

export const TaskItem: React.FC<Props> = ({ task, onToggle, onDelete, onLongPress, onTogglePriority, readOnly, index, variant }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  // Gesture-driven position — separate from the entrance Animated.Value
  // above, driven on the UI thread by the pan gesture below.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const removing = useSharedValue(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.spring(checkAnim, { toValue: task.completed ? 1 : 0, useNativeDriver: true }).start();
  }, [task.completed]);

  const hours = Math.floor(task.duration / 60);
  const mins  = task.duration % 60;
  const durationLabel = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;

  const canDrag = !readOnly && !!(onDelete || onTogglePriority);
  const taskId = task.id;

  const finishDelete = () => { if (onDelete) onDelete(taskId); };
  const firePriorityToggle = () => { if (onTogglePriority) onTogglePriority(taskId); };
  const fireToggle = () => { if (!readOnly) onToggle?.(taskId); };
  const fireLongPress = () => { if (!readOnly) onLongPress?.(taskId); };

  const singleTap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_e, success) => { if (success) runOnJS(fireToggle)(); });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .enabled(!!onTogglePriority && !readOnly)
    .onEnd((_e, success) => { if (success) runOnJS(firePriorityToggle)(); });

  singleTap.requireExternalGestureToFail(doubleTap);

  const longPress = Gesture.LongPress()
    .minDuration(450)
    .enabled(!readOnly && !!onLongPress)
    .onStart(() => { runOnJS(fireLongPress)(); });

  const pan = Gesture.Pan()
    .enabled(!!canDrag)
    .activateAfterLongPress(220)
    .onUpdate(e => {
      dragX.value = e.translationX;
      dragY.value = onTogglePriority ? e.translationY : 0;
    })
    .onEnd(e => {
      if (onDelete && Math.abs(e.translationX) > DELETE_THRESHOLD) {
        removing.value = true;
        dragX.value = withTiming(e.translationX > 0 ? SCREEN_W : -SCREEN_W, { duration: 220 }, () => {
          runOnJS(finishDelete)();
        });
        return;
      }
      if (onTogglePriority && Math.abs(e.translationY) > PRIORITY_DRAG_THRESHOLD) {
        runOnJS(firePriorityToggle)();
      }
      dragX.value = withSpring(0, { damping: 18 });
      dragY.value = withSpring(0, { damping: 18 });
    });

  const holdGestures = Gesture.Race(pan, longPress);
  const tapGestures = Gesture.Exclusive(doubleTap, singleTap);
  const composed = readOnly ? Gesture.Tap().enabled(false) : Gesture.Race(holdGestures, tapGestures);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value * 0.3 }],
    opacity: removing.value ? withTiming(0, { duration: 180 }) : 1,
  }));

  return (
    <Animated.View style={[
      styles.container,
      {
        opacity:   fadeAnim,
        transform: [
          { translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
          { scale: scaleAnim },
        ],
      },
      readOnly && styles.containerReadOnly,
    ]}>
      <GestureDetector gesture={composed}>
        <Reanimated.View
          style={[
            styles.inner,
            variant === 'priority' && styles.innerPriority,
            task.completed && styles.innerCompleted,
            dragStyle,
          ]}
        >
          <Animated.View style={[
            styles.checkbox,
            {
              borderColor:     task.completed ? Colors.primary : Colors.border,
              backgroundColor: task.completed ? Colors.primary : 'transparent',
              transform: [{ scale: checkAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1] }) }],
            },
          ]}>
            {task.completed && <Text style={styles.checkmark}>✓</Text>}
          </Animated.View>

          <View style={styles.content}>
            <Text style={[styles.title, task.completed && styles.titleCompleted]} numberOfLines={2}>
              {task.title}
              {task.repeat && !readOnly && <Text style={styles.repeatBadge}> ↺</Text>}
            </Text>
            <View style={styles.meta}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{task.category}</Text>
              </View>
              <Text style={styles.duration}>⏱ {durationLabel}</Text>
            </View>
          </View>

          {!readOnly && task.isCustom && onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(taskId)}
              style={styles.deleteBtn}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Text style={styles.deleteText}>×</Text>
            </TouchableOpacity>
          )}
        </Reanimated.View>
      </GestureDetector>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  containerReadOnly: { opacity: 0.7 },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  innerPriority: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  innerCompleted: {
    opacity: 0.7,
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  checkbox: {
    width: 30, height: 30,
    borderRadius: BorderRadius.sm, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: { color: Colors.background, fontSize: 16, fontFamily: Fonts.bold },
  content: { flex: 1, gap: 8 },
  title: { ...Typography.bodyLarge, color: Colors.textPrimary, fontFamily: Fonts.medium, fontSize: 17 },
  titleCompleted: { color: Colors.textPrimary, textDecorationLine: 'line-through' },
  repeatBadge: { color: Colors.accent, fontSize: 13, fontFamily: Fonts.regular },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  categoryBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: BorderRadius.sm, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  categoryText: { ...Typography.labelSmall, fontSize: 11, color: Colors.textSecondary },
  duration: { ...Typography.bodySmall, color: Colors.textSecondary },
  deleteBtn: {
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 14,
  },
  deleteText: { color: Colors.textMuted, fontSize: 18, fontFamily: Fonts.bold, lineHeight: 22 },
});
