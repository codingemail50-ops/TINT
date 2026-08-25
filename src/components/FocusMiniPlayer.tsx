import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';

interface Props {
  title: string;
  timeLeft: number;
  paused: boolean;
  onPress: () => void;
  bottomOffset: number;
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// A persistent bar (Spotify's "now playing" strip, same idea) that floats
// above the tab bar whenever a focus session is running but its own
// full-screen UI isn't what's on screen — tap it to jump back in.
export const FocusMiniPlayer: React.FC<Props> = ({ title, timeLeft, paused, onPress, bottomOffset }) => {
  return (
    <TouchableOpacity
      style={[styles.bar, { bottom: bottomOffset }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.dot} />
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.sub}>{paused ? 'Paused' : 'Focusing'}</Text>
      </View>
      <Text style={styles.time}>{formatMMSS(timeLeft)}</Text>
      <Ionicons name="chevron-up" size={16} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.pop,
  },
  textWrap: { flex: 1 },
  title: { fontSize: 13.5, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  sub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1, fontFamily: Fonts.regular },
  time: { fontFamily: Fonts.pixel, fontSize: 17, color: Colors.pop, marginRight: 2 },
});
