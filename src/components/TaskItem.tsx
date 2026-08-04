import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, getCategoryColor } from '../constants/theme';
import { Task } from '../data/examPresets';

interface Props {
  task: Task;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onLongPress?: (id: string) => void;
  readOnly?: boolean;
  index: number;
}

export const TaskItem: React.FC<Props> = ({ task, onToggle, onDelete, onLongPress, readOnly, index }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

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

  const catColor = getCategoryColor(task.category);
  const hours = Math.floor(task.duration / 60);
  const mins  = task.duration % 60;
  const durationLabel = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;

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
      <TouchableOpacity
        style={[styles.inner, task.completed && styles.innerCompleted]}
        onPress={() => !readOnly && onToggle?.(task.id)}
        onLongPress={() => !readOnly && onLongPress?.(task.id)}
        delayLongPress={400}
        activeOpacity={readOnly ? 1 : 0.7}
      >
        <Animated.View style={[
          styles.checkbox,
          {
            borderColor:     task.completed ? Colors.success : Colors.border,
            backgroundColor: task.completed ? Colors.success : 'transparent',
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
            <View style={[styles.categoryBadge, { backgroundColor: catColor }]}>
              <Text style={styles.categoryText}>{task.category}</Text>
            </View>
            <Text style={styles.duration}>⏱ {durationLabel}</Text>
          </View>
        </View>

        {!readOnly && task.isCustom && onDelete && (
          <TouchableOpacity
            onPress={() => onDelete(task.id)}
            style={styles.deleteBtn}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Text style={styles.deleteText}>×</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.sm },
  containerReadOnly: { opacity: 0.7 },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  innerCompleted: {
    opacity: 0.6,
    borderColor: Colors.success + '44',
    backgroundColor: Colors.success + '08',
  },
  checkbox: {
    width: 26, height: 26,
    borderRadius: 8, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  content: { flex: 1, gap: 6 },
  title: { ...Typography.bodyLarge, color: Colors.textPrimary, fontWeight: '500' },
  titleCompleted: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  repeatBadge: { color: Colors.accent, fontSize: 13 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  categoryBadge: {
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  categoryText: { ...Typography.labelSmall, fontSize: 10, color: '#1A1A1A', fontWeight: '700' },
  duration: { ...Typography.bodySmall, color: Colors.textSecondary },
  deleteBtn: {
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: Colors.danger + '22',
  },
  deleteText: { color: Colors.danger, fontSize: 18, fontWeight: '700', lineHeight: 22 },
});
