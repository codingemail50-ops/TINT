import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { LeaderboardEntry } from '../data/leaderboard';

interface Props {
  entry: LeaderboardEntry;
  rank: number;
  index: number;
}

const RANK_STYLES: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: '#F59E0B22', border: '#F59E0B55', text: '#F59E0B' },
  2: { bg: '#9CA3AF22', border: '#9CA3AF55', text: '#9CA3AF' },
  3: { bg: '#CD7C3222', border: '#CD7C3255', text: '#CD7C32' },
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
          <Ionicons name="medal" size={20} color={rankStyle.text} />
        ) : (
          <Text style={[styles.rankNumber, isCurrentUser && { color: Colors.primary }]}>#{rank}</Text>
        )}
      </View>

      <View style={[styles.avatar, rankStyle && { borderColor: rankStyle.border }]}>
        <Ionicons name={(entry.avatar || 'star') as any} size={20} color={Colors.textPrimary} />
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
          <Ionicons name="flame" size={12} color={Colors.textSecondary} />
          <Text style={styles.statItem}>{entry.streak}d</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statItem}>{entry.consistency}% consistent</Text>
          <Text style={styles.statDot}>·</Text>
          <Ionicons name="checkmark" size={12} color={Colors.textSecondary} />
          <Text style={styles.statItem}>{entry.tasksCompleted}</Text>
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
    fontFamily: Fonts.semibold,
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
    fontFamily: Fonts.regular,
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
