import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Fonts } from '../constants/theme';
import { PixelIcon } from './PixelIcon';
import { LeaderboardEntry } from '../data/leaderboard';

interface Props {
  entry: LeaderboardEntry;
  rank: number;
  index: number;
}

// Top-3 medal colors are the one deliberate exception to the app's
// greyscale palette (kept from before the greyscale conversion) — everything
// else on this bar stays grey per the user's "keep the greyscale theme for
// this too" instruction.
const MEDAL_COLORS: Record<number, string> = { 1: '#F59E0B', 2: '#9CA3AF', 3: '#CD7C32' };

const BAR_HEIGHT = 52;
const AVATAR_SIZE = 48;
const WIDTH_MAX = 96;
const WIDTH_MIN = 54;
const WIDTH_STEP = 5;

// A single row of the cascading staircase leaderboard — bar width shrinks
// with rank so the list reads as a descending flight of steps, avatar
// overlaps the bar's flush left edge, and only the free (right) end is
// rounded off, per the user's reference image.
export const LeaderboardCard: React.FC<Props> = ({ entry, rank, index }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const barWidthPct = Math.max(WIDTH_MIN, WIDTH_MAX - (rank - 1) * WIDTH_STEP);
  const medalColor = MEDAL_COLORS[rank];
  const isCurrentUser = entry.isCurrentUser;

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        },
      ]}
    >
      <View style={[styles.bar, { width: `${barWidthPct}%` }, isCurrentUser && styles.barCurrentUser]}>
        <View style={styles.barLeft}>
          {medalColor ? (
            <Ionicons name="medal" size={16} color={medalColor} />
          ) : (
            <Text style={styles.rankNumber}>#{rank}</Text>
          )}
          <Text style={[styles.name, isCurrentUser && styles.nameCurrentUser]} numberOfLines={1}>
            {entry.name}{isCurrentUser ? ' (You)' : ''}
          </Text>
        </View>
        <Text style={styles.value}>{entry.consistency}%</Text>
      </View>

      <View style={styles.avatar}>
        <PixelIcon name={entry.avatar || 'star'} size={26} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: { height: BAR_HEIGHT + 4, marginBottom: Spacing.sm + 2, position: 'relative', justifyContent: 'center' },
  bar: {
    height: BAR_HEIGHT,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: BAR_HEIGHT / 2,
    borderBottomRightRadius: BAR_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: AVATAR_SIZE + 6,
    paddingRight: Spacing.md,
  },
  barCurrentUser: {
    borderColor: Colors.primary + '55',
    backgroundColor: Colors.primaryGlow,
  },
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1, paddingRight: Spacing.sm },
  rankNumber: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textSecondary, width: 22 },
  name: { fontSize: 14, fontFamily: Fonts.semibold, color: Colors.textPrimary, flexShrink: 1 },
  nameCurrentUser: { color: Colors.primary },
  value: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: -0.2 },
  avatar: {
    position: 'absolute',
    left: 0,
    top: 2,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
  },
});
