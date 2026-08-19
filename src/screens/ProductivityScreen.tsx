import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { AppState, getHeatmapData } from '../utils/storage';
import { FocusLogEntry, loadFocusLog, FocusTimeframe, FocusBucket, getFocusSummary } from '../utils/focusLog';
import { REALITY_CHECK_MESSAGES } from '../data/examPresets';

interface Props { appState: AppState }

function formatHours(mins: number): string {
  const h = mins / 60;
  return h >= 10 || Number.isInteger(h) ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

// ── Time-spent bar chart, monochrome ─────────────────────────────────────────
const CHART_H = 150;
const CHART_W = Dimensions.get('window').width - (Spacing.xl + Spacing.md) * 2;

const TimeBarChart: React.FC<{ buckets: FocusBucket[] }> = ({ buckets }) => {
  const maxVal = Math.max(...buckets.map(b => b.mins), 1);
  const barW = Math.max(3, Math.min(20, CHART_W / buckets.length - 4));

  return (
    <View>
      <View style={[chartSt.chartArea, { height: CHART_H, width: CHART_W }]}>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <View key={f} style={[chartSt.gridline, { bottom: CHART_H * f }]} />
        ))}
        <View style={chartSt.barRow}>
          {buckets.map((b, i) => (
            <View key={i} style={chartSt.barCol}>
              <View
                style={[
                  chartSt.bar,
                  { height: Math.max(2, (b.mins / maxVal) * (CHART_H - 8)), width: barW },
                ]}
              />
            </View>
          ))}
        </View>
      </View>
      <View style={chartSt.dayRow}>
        {buckets.map((b, i) => (
          <Text key={i} style={chartSt.dayLabel}>{b.label}</Text>
        ))}
      </View>
    </View>
  );
};

const chartSt = StyleSheet.create({
  chartArea: { justifyContent: 'flex-end' },
  gridline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: Colors.border },
  // Each bucket gets an equal-width flex column (matching dayRow's flex:1
  // labels below) so the bar always sits centered under its own label,
  // regardless of how many buckets the timeframe produces.
  barRow: { flexDirection: 'row', alignItems: 'flex-end', height: '100%' },
  barCol: { flex: 1, alignItems: 'center' },
  bar: { backgroundColor: Colors.gray[200], borderRadius: 3 },
  dayRow: { flexDirection: 'row', marginTop: Spacing.sm },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.regular },
});

// ── Current-streak-only heatmap, monochrome ──────────────────────────────────
function grayShade(v: number): string {
  if (v < 0) return Colors.surface;
  if (v === 0) return Colors.gray[900];
  const stops = [Colors.gray[900], Colors.gray[700], Colors.gray[500], Colors.gray[300], Colors.gray[100]];
  const t = Math.min(v / 100, 1);
  const idx = Math.min(Math.floor(t * (stops.length - 1)), stops.length - 2);
  return stops[idx + 1];
}

const HEAT_CELL = 14;
const HEAT_GAP = 3;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const StreakHeatmap: React.FC<{ history: AppState['history'] }> = ({ history }) => {
  const heatVals = useMemo(() => getHeatmapData(history), [history]);

  let currentStreakLen = 0;
  for (let i = heatVals.length - 1; i >= 0; i--) {
    if (heatVals[i].value === 100) currentStreakLen++;
    else break;
  }
  const streakStart = heatVals.length - currentStreakLen;

  const d0 = new Date();
  d0.setDate(d0.getDate() - (heatVals.length - 1));
  const startDow = d0.getDay();
  const numCols = Math.ceil((startDow + heatVals.length) / 7);

  const grid: (number | null)[][] = [];
  for (let col = 0; col < numCols; col++) {
    const cells: (number | null)[] = [];
    for (let row = 0; row < 7; row++) {
      const linear = col * 7 + row;
      const di = linear - startDow;
      cells.push(di >= 0 && di < heatVals.length ? di : null);
    }
    grid.push(cells);
  }

  return (
    <View style={heatSt.wrapper}>
      <View style={[heatSt.dayLabels, { gap: HEAT_GAP }]}>
        {DAY_LABELS.map((d, i) => (
          <View key={i} style={{ height: HEAT_CELL, justifyContent: 'center' }}>
            <Text style={heatSt.dayLabel}>{i % 2 === 1 ? d : ''}</Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[heatSt.grid, { gap: HEAT_GAP }]}>
          {grid.map((col, ci) => (
            <View key={ci} style={[heatSt.col, { gap: HEAT_GAP }]}>
              {col.map((di, row) => {
                if (di === null) return <View key={row} style={{ width: HEAT_CELL, height: HEAT_CELL }} />;
                const isToday = di === heatVals.length - 1;
                const inStreak = currentStreakLen >= 2 && di >= streakStart;
                const bg = inStreak
                  ? (isToday ? Colors.textPrimary : Colors.gray[300])
                  : grayShade(heatVals[di].value);
                return (
                  <View key={row} style={[heatSt.cell, { width: HEAT_CELL, height: HEAT_CELL, backgroundColor: bg }]}>
                    {inStreak && isToday && (
                      <Ionicons name="checkmark" size={10} color={Colors.background} />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const heatSt = StyleSheet.create({
  wrapper: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  dayLabels: { paddingTop: 2 },
  dayLabel: { fontSize: 9, color: Colors.textMuted, width: 10, textAlign: 'right', fontFamily: Fonts.regular },
  grid: { flexDirection: 'row' },
  col: { flexDirection: 'column' },
  cell: { borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
});

// ── Per-category time donut ───────────────────────────────────────────────────
const PIE_SIZE = 150;
const PIE_R = 60;
const PIE_STROKE = 20;
const PIE_SHADES = [Colors.gray[100], Colors.gray[300], Colors.gray[500], Colors.gray[200], Colors.gray[400], Colors.gray[600]];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

const CategoryDonut: React.FC<{ data: { category: string; mins: number }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.mins, 0);

  if (total === 0) {
    return (
      <View style={[donutSt.empty, { width: PIE_SIZE, height: PIE_SIZE }]}>
        <Text style={donutSt.emptyText}>No tasks{'\n'}completed yet</Text>
      </View>
    );
  }

  const gapDeg = data.length > 1 ? 3 : 0;
  let cursor = 0;
  const segments = data.map((d, i) => {
    const sweep = (d.mins / total) * 360;
    const start = cursor + gapDeg / 2;
    const end = cursor + sweep - gapDeg / 2;
    cursor += sweep;
    return { d: arcPath(PIE_SIZE / 2, PIE_SIZE / 2, PIE_R, start, Math.max(end, start + 0.01)), color: PIE_SHADES[i % PIE_SHADES.length] };
  });

  return (
    <View style={donutSt.row}>
      <View style={{ width: PIE_SIZE, height: PIE_SIZE }}>
        <Svg width={PIE_SIZE} height={PIE_SIZE}>
          {segments.map((seg, i) => (
            <Path key={i} d={seg.d} stroke={seg.color} strokeWidth={PIE_STROKE} fill="none" strokeLinecap="round" />
          ))}
        </Svg>
        <View style={donutSt.center}>
          <Text style={donutSt.centerVal}>{total}</Text>
          <Text style={donutSt.centerUnit}>min today</Text>
        </View>
      </View>
      <View style={donutSt.legend}>
        {data.map((d, i) => (
          <View key={i} style={donutSt.legendRow}>
            <View style={[donutSt.legendDot, { backgroundColor: PIE_SHADES[i % PIE_SHADES.length] }]} />
            <Text style={donutSt.legendText} numberOfLines={1}>{d.category}</Text>
            <Text style={donutSt.legendMins}>{d.mins}m</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const donutSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerVal: { fontFamily: Fonts.retro, fontSize: 30, color: Colors.textPrimary },
  centerUnit: { fontSize: 10, color: Colors.textMuted, marginTop: -2, fontFamily: Fonts.regular },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { flex: 1, ...Typography.bodySmall, color: Colors.textSecondary },
  legendMins: { ...Typography.bodySmall, color: Colors.textMuted, fontSize: 11 },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textMuted, textAlign: 'center', fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular },
});

const TIMEFRAMES: { id: FocusTimeframe; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'allTime', label: 'All Time' },
];

function formatCount(n: number): string {
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1);
}

// ── Main screen ───────────────────────────────────────────────────────────────
export const ProductivityScreen: React.FC<Props> = ({ appState }) => {
  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([]);
  const [timeframe, setTimeframe] = useState<FocusTimeframe>('month');

  useEffect(() => {
    loadFocusLog().then(setFocusLog);
  }, []);

  const summary = useMemo(() => getFocusSummary(focusLog, timeframe), [focusLog, timeframe]);

  const consistencyLast7 = useMemo(() => {
    let sum = 0, count = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const record = appState.history.find(h => h.date === d.toDateString());
      if (record) { sum += record.consistency; count++; }
    }
    return count > 0 ? Math.round(sum / count) : 0;
  }, [appState.history]);

  const realityCheck = REALITY_CHECK_MESSAGES.find(r => consistencyLast7 <= r.threshold)
    ?? REALITY_CHECK_MESSAGES[REALITY_CHECK_MESSAGES.length - 1];

  const todayRecord = appState.history.find(h => h.date === new Date().toDateString());
  const categoryTime = useMemo(() => {
    if (!todayRecord) return [];
    const byCategory = new Map<string, number>();
    for (const t of todayRecord.tasks) {
      if (!t.completed) continue;
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.duration);
    }
    return Array.from(byCategory.entries())
      .map(([category, mins]) => ({ category, mins }))
      .sort((a, b) => b.mins - a.mins);
  }, [todayRecord]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>{summary.periodLabel}</Text>

        <View style={styles.tabRow}>
          {TIMEFRAMES.map(tf => (
            <TouchableOpacity
              key={tf.id}
              style={[styles.tab, timeframe === tf.id && styles.tabActive]}
              onPress={() => setTimeframe(tf.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, timeframe === tf.id && styles.tabTextActive]}>{tf.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={18} color={Colors.textPrimary} />
            <Text style={styles.statValue}>{formatHours(summary.totalMins)}</Text>
            <Text style={styles.statLabel}>Time focused</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="layers-outline" size={18} color={Colors.textPrimary} />
            <Text style={styles.statValue}>{summary.sessionCount}</Text>
            <Text style={styles.statLabel}>Focus Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="hourglass-outline" size={18} color={Colors.textPrimary} />
            <Text style={styles.statValue}>{formatHours(summary.avgMinsPerDay)}</Text>
            <Text style={styles.statLabel}>Avg Duration / Day</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="stats-chart-outline" size={18} color={Colors.textPrimary} />
            <Text style={styles.statValue}>{formatCount(summary.avgSessionsPerDay)}</Text>
            <Text style={styles.statLabel}>Avg Sessions / Day</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Time Spent</Text>
        <View style={styles.sectionCard}>
          <TimeBarChart buckets={summary.buckets} />
        </View>

        <Text style={styles.sectionLabel}>Current Streak</Text>
        <View style={styles.sectionCard}>
          <StreakHeatmap history={appState.history} />
        </View>

        <Text style={styles.sectionLabel}>Today by Category</Text>
        <View style={styles.sectionCard}>
          <CategoryDonut data={categoryTime} />
        </View>

        {consistencyLast7 < 95 && (
          <View style={styles.realityCard}>
            <View style={[styles.realityGradient, { backgroundColor: consistencyLast7 >= 70 ? Colors.surfaceElevated : Colors.dangerGlow }]}>
              <Ionicons
                name={consistencyLast7 >= 70 ? 'flash' : consistencyLast7 >= 50 ? 'warning' : 'alert-circle'}
                size={20}
                color={consistencyLast7 >= 70 ? Colors.gray[200] : Colors.danger}
              />
              <Text style={styles.realityMessage}>{realityCheck.message}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: 56 },

  title: { ...Typography.displayMedium, color: Colors.textPrimary },
  subtitle: { ...Typography.bodyMedium, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.lg },

  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.full,
    padding: 3, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: BorderRadius.full, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.gray[100] },
  tabText: { ...Typography.bodySmall, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  tabTextActive: { color: Colors.background },

  sectionLabel: { ...Typography.labelSmall, color: Colors.textSecondary, marginBottom: Spacing.sm },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    flexBasis: '48%', flexGrow: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    gap: 4,
  },
  statValue: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { ...Typography.bodySmall, color: Colors.textSecondary },

  sectionCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },

  realityCard: {
    borderRadius: BorderRadius.lg, overflow: 'hidden',
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.danger + '33',
  },
  realityGradient: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  realityMessage: { flex: 1, ...Typography.bodyMedium, color: Colors.textSecondary, lineHeight: 20 },
});
