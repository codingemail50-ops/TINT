import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { Task } from '../data/examPresets';

const SCREEN_W = Dimensions.get('window').width;
const DELETE_THRESHOLD = SCREEN_W * 0.32;

interface Props {
  task: Task;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Fired on long-press — reveals the edit/remove icons (see
   *  actionsVisible) rather than opening anything directly itself. */
  onLongPress?: (id: string) => void;
  /** Pencil icon tap, only reachable once actionsVisible is true. */
  onEdit?: (id: string) => void;
  /** True while this task's edit/remove icons are showing (set by the
   *  parent in response to onLongPress) — swaps the whole row over to a
   *  plain, non-gesture view with the two icons instead of the normal
   *  tap/drag-enabled one. */
  actionsVisible?: boolean;
  /** Tapping the row itself while actionsVisible is true — dismisses the
   *  icons without editing or deleting anything. */
  onDismissActions?: () => void;
  /** Double-tap on the row itself moves the task into (or, if it's already
   *  there, out of) the High Priority group — double-tap again to send it
   *  back. Guarded with requireExternalGestureToFail below so the first tap
   *  of a double-tap doesn't also fire onToggle (mark-complete) before the
   *  second tap arrives. Omitted for Done tasks — priority is a To Do /
   *  High Priority concept only. */
  onTogglePriority?: (id: string) => void;
  readOnly?: boolean;
  index: number;
  /** 'priority' sits on the orange High Priority panel — inner card goes
   *  near-black for contrast. 'done' sits on the white Done panel. */
  variant?: 'priority' | 'done';
}

export const TaskItem: React.FC<Props> = ({
  task, onToggle, onDelete, onLongPress, onEdit, actionsVisible, onDismissActions, onTogglePriority, readOnly, index, variant,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  // Gesture-driven position — separate from the entrance Animated.Value
  // above, driven on the UI thread by the pan gesture below.
  const dragX = useSharedValue(0);
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

  // The "held down" feel long-press is going for — grows slightly the
  // moment the edit/remove/priority icons appear, settles back down if
  // they're dismissed.
  const growAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(growAnim, { toValue: actionsVisible ? 1.035 : 1, friction: 7, useNativeDriver: true }).start();
  }, [actionsVisible]);

  const hours = Math.floor(task.duration / 60);
  const mins  = task.duration % 60;
  const durationLabel = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;

  const canDrag = !readOnly && !!onDelete;
  const taskId = task.id;

  const finishDelete = () => { if (onDelete) onDelete(taskId); };
  const fireToggle = () => { if (!readOnly) onToggle?.(taskId); };
  const fireLongPress = () => { if (!readOnly) onLongPress?.(taskId); };
  const fireTogglePriority = () => { if (!readOnly) onTogglePriority?.(taskId); };

  // Two quick taps toggle High Priority; the same two taps again send it
  // back. requireExternalGestureToFail makes singleTap wait to see whether
  // a second tap is coming before it commits to mark-complete — otherwise
  // the first tap of every double-tap would complete the task an instant
  // before the priority toggle also fired.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((_e, success) => { if (success) runOnJS(fireTogglePriority)(); });

  const singleTap = Gesture.Tap()
    .maxDuration(250)
    .requireExternalGestureToFail(doubleTap)
    .onEnd((_e, success) => { if (success) runOnJS(fireToggle)(); });

  const longPress = Gesture.LongPress()
    .minDuration(450)
    .enabled(!readOnly && !!onLongPress)
    .onStart(() => { runOnJS(fireLongPress)(); });

  const pan = Gesture.Pan()
    .enabled(!!canDrag)
    // Was activateAfterLongPress(150) racing against longPress's 450ms —
    // pan only needs elapsed time to activate, not actual movement, so it
    // was winning that race and claiming the gesture on every hold before
    // longPress ever got a chance to fire, no matter how still the finger
    // stayed. minDistance requires real movement to activate instead, so a
    // still hold now correctly falls through to longPress at 450ms, and an
    // actual swipe/drag still activates pan immediately regardless of time.
    .minDistance(10)
    .onUpdate(e => {
      dragX.value = e.translationX;
    })
    .onEnd(e => {
      if (onDelete && Math.abs(e.translationX) > DELETE_THRESHOLD) {
        removing.value = true;
        dragX.value = withTiming(e.translationX > 0 ? SCREEN_W : -SCREEN_W, { duration: 220 }, () => {
          runOnJS(finishDelete)();
        });
        return;
      }
      dragX.value = withSpring(0, { damping: 18 });
    });

  const holdGestures = Gesture.Race(pan, longPress);
  const composed = readOnly ? Gesture.Tap().enabled(false) : Gesture.Race(holdGestures, doubleTap, singleTap);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
    opacity: removing.value ? withTiming(0, { duration: 180 }) : 1,
  }));

  // Long-press reveals this instead of opening anything directly — a plain
  // (no gesture-handler) row with the title for context plus pencil/cross
  // buttons, so editing and removing are both one direct tap away rather
  // than routed through a modal. Tapping the row itself just dismisses it.
  if (actionsVisible) {
    return (
      <Animated.View style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ scale: growAnim }] },
      ]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onDismissActions}
          style={[styles.inner, styles.innerActionsVisible, variant === 'priority' && styles.innerPriority, task.completed && styles.innerCompleted]}
        >
          <View style={[styles.checkbox, { borderColor: task.completed ? Colors.primary : Colors.border, backgroundColor: task.completed ? Colors.primary : 'transparent' }]}>
            {task.completed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.content}>
            <Text style={[styles.title, task.completed && styles.titleCompleted]} numberOfLines={2}>{task.title}</Text>
            <View style={styles.meta}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{task.category}</Text>
              </View>
              <Text style={styles.duration}>⏱ {durationLabel}</Text>
            </View>
          </View>
          <View style={styles.actionRow}>
            {onEdit && (
              <TouchableOpacity
                onPress={() => onEdit(taskId)}
                style={styles.actionBtn}
                hitSlop={{ top: 10, right: 6, bottom: 10, left: 6 }}
              >
                <Ionicons name="pencil" size={18} color={Colors.textPrimary} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={() => onDelete(taskId)}
                style={[styles.actionBtn, styles.actionBtnDanger]}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 6 }}
              >
                <Ionicons name="close" size={18} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

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
  innerActionsVisible: {
    borderColor: Colors.pop,
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
  actionRow: { flexDirection: 'row', gap: Spacing.sm, flexShrink: 0 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnDanger: { borderColor: Colors.danger + '55' },
});
