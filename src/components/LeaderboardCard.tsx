import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { LeaderboardEntry } from '../data/leaderboard';

interface Props {
  entry: LeaderboardEntry;
  rank: number;
  index: number;
}

const RANK_STYLES: Record<number, { bg: string; border: string; text: string; label: string }> = {
  1: { bg: '#F59E0B22', border: '#F59E0B55', text: '#F59E0B', label: '🥇' },
  2: { bg: '#9CA3AF22', border: '#9CA3AF55', text: '#9CA3AF', label: '🥈' },
  3: { bg: '#CD7C3222', border: '#CD7C3255', text: '#CD7C32', label: '🥉' },
};

export const LeaderboardCard: React.FC<Props> = ({ entry, rank, index }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const rankStyle = RANK_STYLES[rank];
  const isCurrentUser = entry.isCurrentUser;

  return (
    <Animated.View
      style={[
        styles.container,
        rankStyle && { backgroundColor: rankStyle.bg, borderColor: rankStyle.border },
        isCurrentUser && styles.currentUser,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        },
      ]}
    >
      <View style={styles.rankContainer}>
        {rankStyle ? (
          <Text style={styles.rankEmoji}>{rankStyle.label}</Text>
        ) : (
          <Text style={[styles.rankNumber, isCurrentUser && { color: Colors.primary }]}>#{rank}</Text>
        )}
      </View>

      <View style={[styles.avatar, rankStyle && { borderColor: rankStyle.border }]}>
        <Text style={styles.avatarEmoji}>{entry.avatar}</Text>
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isCurrentUser && { color: Colors.primary }]}>
            {entry.name}
            {isCurrentUser ? ' (You)' : ''}
          </Text>
          <View style={styles.examBadge}>
            <Text style={styles.examText}>{entry.examType}</Text>
          </View>
        </View>
        <View style={styles.stats}>
          <Text style={styles.statItem}>🔥 {entry.streak}d</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statItem}>{entry.consistency}% consistent</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statItem}>✓ {entry.tasksCompleted}</Text>
        </View>
      </View>

      <View style={styles.consistencyBar}>
        <View style={[styles.consistencyFill, { height: `${entry.consistency}%` as any, backgroundColor: rankStyle?.text ?? Colors.primary }]} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  currentUser: {
    borderColor: Colors.primary + '55',
    backgroundColor: Colors.primaryGlow,
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 20,
  },
  rankNumber: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  examBadge: {
    backgroundColor: Colors.primary + '22',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  examText: {
    ...Typography.labelSmall,
    color: Colors.primaryLight,
    fontSize: 10,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  statItem: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  statDot: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  consistencyBar: {
    width: 4,
    height: 44,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  consistencyFill: {
    width: '100%',
    borderRadius: 2,
  },
});
