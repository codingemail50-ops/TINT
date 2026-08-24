import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../constants/theme';
import { PixelIcon } from './PixelIcon';
import { LeaderboardEntry, LeaderboardPeriod, minsForPeriod, formatHMS } from '../data/leaderboard';

interface Props {
  top3: LeaderboardEntry[];
  period: LeaderboardPeriod;
}

const RING_SIZE = { 1: 88, 2: 68, 3: 68 } as const;

// Reorders top3 (already rank-sorted 1,2,3) into the visual left-to-right
// podium arrangement: #2, #1 (center, biggest), #3.
export const LeaderboardPodium: React.FC<Props> = ({ top3, period }) => {
  const [first, second, third] = top3;
  const order: [LeaderboardEntry | undefined, number][] = [[second, 2], [first, 1], [third, 3]];

  return (
    <View style={styles.row}>
      {order.map(([entry, rank]) => {
        if (!entry) return <View key={rank} style={{ width: RING_SIZE[rank as 1 | 2 | 3] }} />;
        const size = RING_SIZE[rank as 1 | 2 | 3];
        return (
          <View key={entry.id} style={[styles.col, rank === 1 && styles.colFirst]}>
            <View style={styles.avatarWrap}>
              <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
                <PixelIcon name={entry.avatar} size={size * 0.56} />
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{rank}</Text>
              </View>
            </View>
            <Text style={styles.name} numberOfLines={1}>{entry.name}</Text>
            <Text style={styles.value}>{formatHMS(minsForPeriod(entry, period))}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 18 },
  col: { alignItems: 'center', gap: 6, width: 96 },
  colFirst: { marginBottom: 12 },
  avatarWrap: { position: 'relative' },
  ring: {
    borderWidth: 2, borderColor: Colors.textPrimary,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  badgeText: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.background },
  name: { fontSize: 12, fontFamily: Fonts.semibold, color: Colors.textPrimary, letterSpacing: 0.3, textTransform: 'uppercase' },
  value: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
