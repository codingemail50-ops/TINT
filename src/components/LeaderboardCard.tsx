import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Fonts, BorderRadius } from '../constants/theme';
import { PixelIcon } from './PixelIcon';
import { LeaderboardEntry, LeaderboardPeriod, minsForPeriod, formatHMS } from '../data/leaderboard';

interface Props {
  entry: LeaderboardEntry;
  rank: number;
  period: LeaderboardPeriod;
}

// A single flat list row — rank #, avatar, name, time — no bars, no
// gradients. The current-user row gets a plain light highlight, everything
// else stays on the screen's base background.
export const LeaderboardCard: React.FC<Props> = ({ entry, rank, period }) => {
  return (
    <View style={[styles.row, entry.isCurrentUser && styles.rowHighlight]}>
      <Text style={[styles.rank, entry.isCurrentUser && styles.rankHighlight]}>{rank}</Text>
      <View style={styles.avatar}>
        <PixelIcon name={entry.avatar} size={22} />
      </View>
      <Text style={[styles.name, entry.isCurrentUser && styles.nameHighlight]} numberOfLines={1}>
        {entry.name}
      </Text>
      <Text style={[styles.value, entry.isCurrentUser && styles.valueHighlight]}>
        {formatHMS(minsForPeriod(entry, period))}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: 12, paddingHorizontal: Spacing.md,
  },
  rowHighlight: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
  rank: { width: 24, fontSize: 13, fontFamily: Fonts.semibold, color: Colors.textMuted },
  rankHighlight: { color: Colors.background },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { flex: 1, fontSize: 14, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  nameHighlight: { color: Colors.background },
  value: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
  valueHighlight: { color: Colors.background },
});
