import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, ScrollView } from 'react-native';
import { HistoryEntry } from '../types';
import { getAppDate, daysUntil } from '../utils/logic';

const EXAM_DATE = '2027-01-17';
const COLS = 10;
const { width } = Dimensions.get('window');
const GAP = 3;
const TILE_SIZE = Math.floor((width - 40 - GAP * (COLS - 1)) / COLS);

interface Props {
  history: HistoryEntry[];
}

function getTileColor(pct: number | null, isExamDay: boolean, isYesterday: boolean): string {
  if (isExamDay) return '#F59E0B';
  if (pct === null) return 'rgba(255,255,255,0.05)'; // future
  if (pct === 100) return '#22C55E';
  if (pct >= 50) return '#FBBF24';
  if (pct > 0) return '#F97316';
  return '#EF4444';
}

function getTileGlow(pct: number | null, isExamDay: boolean): string {
  if (isExamDay) return 'rgba(245,158,11,0.5)';
  if (pct === 100) return 'rgba(34,197,94,0.4)';
  if (pct !== null && pct >= 50) return 'rgba(251,191,36,0.3)';
  return 'transparent';
}

export default function UCEEDWall({ history }: Props) {
  const today = getAppDate();
  const daysLeft = daysUntil(EXAM_DATE);
  const totalDays = daysLeft + 1; // include exam day

  // Build date map from history
  const historyMap: Record<string, number> = {};
  for (const e of history) {
    historyMap[e.date] = e.pct;
  }

  // Build tile list: from today going forward to exam day
  const tiles: { date: string; pct: number | null; isExamDay: boolean; isYesterday: boolean }[] = [];

  // Show up to 90 past days + all future days
  const PAST_DAYS = 90;
  for (let i = PAST_DAYS; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    tiles.push({
      date: dateStr,
      pct: historyMap[dateStr] ?? 0,
      isExamDay: false,
      isYesterday: i === 1,
    });
  }
  // Today
  tiles.push({ date: today, pct: historyMap[today] ?? null, isExamDay: false, isYesterday: false });
  // Future days
  for (let i = 1; i < daysLeft; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    tiles.push({ date: dateStr, pct: null, isExamDay: false, isYesterday: false });
  }
  // Exam day
  tiles.push({ date: EXAM_DATE, pct: null, isExamDay: true, isYesterday: false });

  // Animate tiles in staggered
  const anims = useRef(tiles.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Animate in batches of COLS to avoid too many animations
    const batchSize = COLS * 3;
    const batches: Animated.CompositeAnimation[] = [];

    for (let i = 0; i < anims.length; i += batchSize) {
      const batch = anims.slice(i, i + batchSize).map(a =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 })
      );
      batches.push(Animated.parallel(batch));
    }

    Animated.stagger(40, batches).start();
  }, []);

  const rows: typeof tiles[] = [];
  for (let i = 0; i < tiles.length; i += COLS) {
    rows.push(tiles.slice(i, i + COLS));
  }

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.title}>UCEED Wall</Text>
        <View style={s.badge}>
          <Text style={s.badgeDays}>{daysLeft}</Text>
          <Text style={s.badgeLabel}> days left</Text>
        </View>
      </View>
      <Text style={s.sub}>Each tile = one day. Fill them all.</Text>

      <ScrollView style={s.wallScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <View style={s.grid}>
          {tiles.map((tile, i) => {
            const color = getTileColor(tile.pct, tile.isExamDay, tile.isYesterday);
            const glow = getTileGlow(tile.pct, tile.isExamDay);
            return (
              <Animated.View
                key={tile.date}
                style={[
                  s.tile,
                  {
                    backgroundColor: color,
                    shadowColor: glow,
                    shadowOpacity: glow !== 'transparent' ? 1 : 0,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: glow !== 'transparent' ? 4 : 0,
                    transform: [{ scale: anims[i] }],
                    opacity: anims[i],
                    borderWidth: tile.isExamDay ? 1 : 0,
                    borderColor: tile.isExamDay ? '#F59E0B' : 'transparent',
                  },
                ]}
              />
            );
          })}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={s.legend}>
        {[
          { color: '#22C55E', label: '100%' },
          { color: '#FBBF24', label: '50%+' },
          { color: '#F97316', label: 'Partial' },
          { color: '#EF4444', label: 'Missed' },
          { color: '#F59E0B', label: 'Exam day' },
        ].map(({ color, label }) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  badge: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  badgeDays: { color: '#F59E0B', fontSize: 14, fontWeight: '800' },
  badgeLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  sub: { color: 'rgba(255,255,255,0.2)', fontSize: 11, marginBottom: 12 },
  wallScroll: { maxHeight: 220 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
});
