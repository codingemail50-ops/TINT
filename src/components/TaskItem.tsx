import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { Task } from '../data/examPresets';

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;
  index: number;
}

export const TaskItem: React.FC<Props> = ({ task, onToggle, onDelete, index }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const strikeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(checkAnim, { toValue: task.completed ? 1 : 0, useNativeDriver: true }),
      Animated.timing(strikeAnim, { toValue: task.completed ? 1 : 0, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [task.completed]);

  const CATEGORY_COLORS: Record<string, string> = {
    Physics: '#3B82F6',
    Chemistry: '#10B981',
    Mathematics: '#7C3AED',
    Biology: '#F59E0B',
    Revision: '#8B5CF6',
    Practice: '#EF4444',
    Reading: '#06B6D4',
    'Current Affairs': '#F97316',
    History: '#A78BFA',
    Geography: '#34D399',
    Polity: '#60A5FA',
    Writing: '#F472B6',
    Quant: '#7C3AED',
    VARC: '#06B6D4',
    DILR: '#10B981',
    Analysis: '#F59E0B',
    Math: '#7C3AED',
    English: '#3B82F6',
    Study: '#8B5CF6',
  };

  const catColor = CATEGORY_COLORS[task.category] ?? Colors.primary;
  const hours = Math.floor(task.duration / 60);
  const mins = task.duration % 60;
  const durationLabel = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.inner, task.completed && styles.innerCompleted]}
        onPress={() => onToggle(task.id)}
        activeOpacity={0.7}
      >
        <Animated.View
          style={[
            styles.checkbox,
            {
              borderColor: task.completed ? catColor : Colors.border,
              backgroundColor: task.completed ? catColor : 'transparent',
              transform: [{ scale: checkAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1] }) }],
            },
          ]}
        >
          {task.completed && <Text style={styles.checkmark}>✓</Text>}
        </Animated.View>

        <View style={styles.content}>
          <Animated.Text
            style={[
              styles.title,
              task.completed && styles.titleCompleted,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Animated.Text>
          <View style={styles.meta}>
            <View style={[styles.categoryBadge, { backgroundColor: catColor + '22', borderColor: catColor + '44' }]}>
              <Text style={[styles.categoryText, { color: catColor }]}>{task.category}</Text>
            </View>
            <Text style={styles.duration}>⏱ {durationLabel}</Text>
          </View>
        </View>

        {task.isCustom && onDelete && (
          <TouchableOpacity onPress={() => onDelete(task.id)} style={styles.deleteBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Text style={styles.deleteText}>×</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
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
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    gap: 6,
  },
  title: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  titleCompleted: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  categoryText: {
    ...Typography.labelSmall,
    fontSize: 10,
  },
  duration: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.danger + '22',
  },
  deleteText: {
    color: Colors.danger,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
});
