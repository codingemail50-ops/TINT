import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { AppState } from '../utils/storage';
import { FocusLogEntry, loadFocusLog, FocusTimeframe, FocusBucket, getFocusSummary, getFocusHeatmap } from '../utils/focusLog';
import { DistractionLogEntry, loadDistractionLog } from '../utils/distractionLog';
import { subscribeDevClock } from '../utils/devClock';
import { REALITY_CHECK_MESSAGES } from '../data/examPresets';

interface Props { appState: AppState }

function formatHours(mins: number): string {
  const h = mins / 60;
  return h >= 10 || Number.isInteger(h) ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

function formatMinsShort(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Focus-vs-distracted bar chart, orange over white ─────────────────────────
const CHART_H = 190;
const YAXIS_W = 30;
const TOOLTIP_W = 132;
// Fixed width per bucket — generous enough that ~4-5 fit on screen at once
// with a real, readable date under each, rather than squeezing every bucket
// for a timeframe into one fixed width (illegible bars, sparse labels, and
// touch-to-bucket mapping that only worked by coincidence). More buckets
// than fit on screen just scroll instead.
const BAR_COL_WIDTH = 68;

const DualBarChart: React.FC<{ buckets: FocusBucket[] }> = ({ buckets }) => {
  const [touchIdx, setTouchIdx] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const maxMins = Math.max(...buckets.map(b => Math.max(b.mins, b.distractedMins)), 60);
  const maxHours = Math.max(1, Math.ceil(maxMins / 60));
  const step = maxHours <= 4 ? 1 : Math.ceil(maxHours / 4);
  const topHours = Math.ceil(maxHours / step) * step;
  const scaleMins = topHours * 60;
  const hourMarks: number[] = [];
  for (let h = step; h <= topHours; h += step) hourMarks.push(h);

  const barW = 22;
  const frontW = Math.max(2, barW * 0.55);
  const contentWidth = buckets.length * BAR_COL_WIDTH;

  // Most recent bucket (today / this month / this hour) is what people
  // check by default — land there instead of at the start of history.
  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }, [buckets.length]);

  const touched = touchIdx !== null ? buckets[touchIdx] : null;
  const tooltipLeft = touchIdx !== null
    ? Math.max(0, Math.min(contentWidth - TOOLTIP_W, touchIdx * BAR_COL_WIDTH + BAR_COL_WIDTH / 2 - TOOLTIP_W / 2))
    : 0;

  return (
    <View style={chartSt.row}>
      <View style={[chartSt.yAxis, { height: CHART_H }]}>
        {hourMarks.map(h => (
          <Text key={h} style={[chartSt.yLabel, { bottom: (h * 60 / scaleMins) * CHART_H - 6 }]}>{h}h</Text>
        ))}
      </View>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} style={chartSt.scroller}>
        <View style={{ width: contentWidth }}>
          <View style={[chartSt.chartArea, { height: CHART_H }]}>
            {hourMarks.map(h => (
              <View key={h} style={[chartSt.gridline, { bottom: (h * 60 / scaleMins) * CHART_H }]} />
            ))}
            <View style={chartSt.barRow}>
              {buckets.map((b, i) => {
                const focusH = Math.max(b.mins > 0 ? 2 : 0, (b.mins / scaleMins) * CHART_H);
                const distH = Math.max(b.distractedMins > 0 ? 2 : 0, (b.distractedMins / scaleMins) * CHART_H);
                const focusFront = b.mins <= b.distractedMins;
                const [bottomBar, topBar] = focusFront
                  ? [{ height: distH, width: barW, backgroundColor: Colors.primary }, { height: focusH, width: frontW, backgroundColor: Colors.pop }]
                  : [{ height: focusH, width: barW, backgroundColor: Colors.pop }, { height: distH, width: frontW, backgroundColor: Colors.primary }];
                return (
                  <TouchableOpacity
                    key={i}
                    style={[chartSt.barCol, { width: BAR_COL_WIDTH }]}
                    activeOpacity={1}
                    onPressIn={() => setTouchIdx(i)}
                    onPressOut={() => setTouchIdx(null)}
                  >
                    <View style={[chartSt.bar, chartSt.barBack, bottomBar]} />
                    <View style={[chartSt.bar, chartSt.barFront, topBar]} />
                  </TouchableOpacity>
                );
              })}
            </View>
            {touched && (
              <View style={[chartSt.tooltip, { left: tooltipLeft, width: TOOLTIP_W }]}>
                <Text style={chartSt.tooltipDate}>{touched.dateLabel}</Text>
                <View style={chartSt.tooltipRow}>
                  <View style={[chartSt.tooltipDot, { backgroundColor: Colors.pop }]} />
                  <Text style={chartSt.tooltipText}>Focus {formatMinsShort(touched.mins)}</Text>
                </View>
                <View style={chartSt.tooltipRow}>
                  <View style={[chartSt.tooltipDot, { backgroundColor: Colors.primary }]} />
                  <Text style={chartSt.tooltipText}>Distracted {formatMinsShort(touched.distractedMins)}</Text>
                </View>
              </View>
            )}
          </View>
          <View style={chartSt.dayRow}>
            {buckets.map((b, i) => (
              <Text key={i} style={[chartSt.dayLabel, { width: BAR_COL_WIDTH }]} numberOfLines={1}>{b.label}</Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const chartSt = StyleSheet.create({
  row: { flexDirection: 'row' },
  yAxis: { width: YAXIS_W, justifyContent: 'flex-end' },
  yLabel: { position: 'absolute', right: 6, fontSize: 9, color: Colors.textMuted, fontFamily: Fonts.regular },
  scroller: { flex: 1 },
  chartArea: { justifyContent: 'flex-end', position: 'relative' },
  gridline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: Colors.border },
  // Fixed-width columns (BAR_COL_WIDTH) now, not flex — the chart scrolls
  // horizontally instead of squeezing every bucket into the screen width.
  barRow: { flexDirection: 'row', alignItems: 'flex-end', height: '100%' },
  barCol: { height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { position: 'absolute', bottom: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barBack: { zIndex: 1 },
  barFront: { zIndex: 2 },
  dayRow: { flexDirection: 'row', marginTop: Spacing.sm },
  dayLabel: { textAlign: 'center', fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.regular },
  tooltip: {
    position: 'absolute', top: -8, backgroundColor: Colors.gray[900], borderRadius: BorderRadius.md,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border, zIndex: 10, gap: 3,
  },
  tooltipDate: { fontSize: 10, color: Colors.textMuted, fontFamily: Fonts.semibold, marginBottom: 2, textTransform: 'uppercase' },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tooltipDot: { width: 7, height: 7, borderRadius: 4 },
  tooltipText: { fontSize: 11, color: Colors.textPrimary, fontFamily: Fonts.medium },
});

// ── Focus heatmap, binary orange (focused) / grey (no show) ──────────────────
const HEAT_CELL = 14;
const HEAT_GAP = 3;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const StreakHeatmap: React.FC<{ focusLog: FocusLogEntry[] }> = ({ focusLog }) => {
  const heatVals = useMemo(() => getFocusHeatmap(focusLog), [focusLog]);

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
                const bg = heatVals[di].focused ? Colors.pop : Colors.gray[600];
                return (
                  <View key={row} style={[heatSt.cell, { width: HEAT_CELL, height: HEAT_CELL, backgroundColor: bg }]} />
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
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'allTime', label: 'All Time' },
];

function formatCount(n: number): string {
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1);
}

// ── Main screen ───────────────────────────────────────────────────────────────
export const ProductivityScreen: React.FC<Props> = ({ appState }) => {
  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([]);
  const [distractionLog, setDistractionLog] = useState<DistractionLogEntry[]>([]);
  const [timeframe, setTimeframe] = useState<FocusTimeframe>('month');

  useEffect(() => {
    loadFocusLog().then(setFocusLog);
    loadDistractionLog().then(setDistractionLog);
  }, []);

  // Screens stay mounted across tab switches now, so the dev-mode day-skip
  // tool needs an explicit nudge to refetch — otherwise this screen would
  // keep showing data loaded before the day advanced.
  useEffect(() => subscribeDevClock(() => {
    loadFocusLog().then(setFocusLog);
    loadDistractionLog().then(setDistractionLog);
  }), []);

  const summary = useMemo(() => getFocusSummary(focusLog, timeframe, distractionLog), [focusLog, distractionLog, timeframe]);

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
          <DualBarChart buckets={summary.buckets} />
        </View>

        <Text style={styles.sectionLabel}>Current Streak</Text>
        <View style={styles.sectionCard}>
          <StreakHeatmap focusLog={focusLog} />
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

  title: { ...Typography.displayMedium, color: Colors.pop },
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
