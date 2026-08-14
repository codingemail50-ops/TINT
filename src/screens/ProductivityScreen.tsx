import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { AppState, getHeatmapData } from '../utils/storage';
import { FocusLogEntry, loadFocusLog, getLast7DaysFocus } from '../utils/focusLog';
import { REALITY_CHECK_MESSAGES } from '../data/examPresets';

interface Props { appState: AppState }

// ── Focus-time capsule chart (7 days, gridlines, dot markers for small values) ──
const DOT_THRESHOLD = 15;
const CHART_H = 140;

const FocusTimeChart: React.FC<{ data: { day: string; mins: number }[] }> = ({ data }) => {
  const maxVal = Math.max(...data.map(d => d.mins), 1);
  const topHours = Math.max(1, Math.ceil(maxVal / 60));
  const topMin = topHours * 60;

  return (
    <View>
      <View style={[chartSt.chartArea, { height: CHART_H }]}>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <View key={f} style={[chartSt.gridline, { bottom: CHART_H * f }]} />
        ))}
        <View style={chartSt.barRow}>
          {data.map((d, i) => {
            const h = Math.round((d.mins / topMin) * CHART_H);
            return (
              <View key={i} style={chartSt.barCol}>
                {d.mins < DOT_THRESHOLD ? (
                  <View style={chartSt.dot} />
                ) : (
                  <LinearGradient
                    colors={[Colors.blue[300], Colors.blue[600]]}
                    style={[chartSt.bar, { height: Math.max(h, 8) }]}
                  />
                )}
              </View>
            );
          })}
        </View>
      </View>
      <View style={chartSt.dayRow}>
        {data.map((d, i) => (
          <Text key={i} style={chartSt.dayLabel}>{d.day}</Text>
        ))}
      </View>
    </View>
  );
};

const chartSt = StyleSheet.create({
  chartArea: { justifyContent: 'flex-end' },
  gridline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: Colors.border },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', height: '100%', gap: 8 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '62%', borderRadius: 999 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.blue[700], marginBottom: 2 },
  dayRow: { flexDirection: 'row', marginTop: Spacing.sm },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: Colors.textMuted },
});

// ── Current-streak-only fire heatmap ─────────────────────────────────────────
function blueShade(v: number): string {
  if (v < 0) return Colors.surface;
  if (v === 0) return '#141D27';
  const stops = ['#16212C', '#1D415D', '#2470A5', '#348DC3', '#73B5DD'];
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
                  ? (isToday ? Colors.streakColors.hot : 'rgba(251,146,60,0.35)')
                  : blueShade(heatVals[di].value);
                return (
                  <View key={row} style={[heatSt.cell, { width: HEAT_CELL, height: HEAT_CELL, backgroundColor: bg }]}>
                    {inStreak && isToday && (
                      <Ionicons name="flame" size={10} color="#FFD23F" />
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
  dayLabel: { fontSize: 9, color: Colors.textMuted, width: 10, textAlign: 'right' },
  grid: { flexDirection: 'row' },
  col: { flexDirection: 'column' },
  cell: { borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
});

// ── Per-category time donut ───────────────────────────────────────────────────
const PIE_SIZE = 150;
const PIE_R = 60;
const PIE_STROKE = 20;
const PIE_SHADES = [Colors.blue[300], Colors.blue[500], Colors.blue[700], Colors.blue[400], Colors.blue[600], Colors.blue[800]];

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
  centerUnit: { fontSize: 10, color: Colors.textMuted, marginTop: -2 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { flex: 1, ...Typography.bodySmall, color: Colors.textSecondary },
  legendMins: { ...Typography.bodySmall, color: Colors.textMuted, fontSize: 11 },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textMuted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export const ProductivityScreen: React.FC<Props> = ({ appState }) => {
  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([]);

  useEffect(() => {
    loadFocusLog().then(setFocusLog);
  }, []);

  const last7Focus = useMemo(() => getLast7DaysFocus(focusLog), [focusLog]);

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

        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.blue[400]} />
            <Text style={styles.statValue}>{appState.totalTasksCompleted}</Text>
            <Text style={styles.statLabel}>Tasks Done</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="stats-chart" size={20} color={Colors.blue[400]} />
            <Text style={styles.statValue}>{consistencyLast7}%</Text>
            <Text style={styles.statLabel}>7-Day Avg</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <FocusTimeChart data={last7Focus} />
          <Text style={styles.chartCaption}>Screen-time comparison needs a native build — coming soon.</Text>
        </View>

        <View style={styles.sectionCard}>
          <StreakHeatmap history={appState.history} />
        </View>

        <View style={styles.sectionCard}>
          <CategoryDonut data={categoryTime} />
        </View>

        {consistencyLast7 < 95 && (
          <View style={styles.realityCard}>
            <View style={[styles.realityGradient, { backgroundColor: consistencyLast7 >= 70 ? Colors.surfaceElevated : Colors.dangerGlow }]}>
              <Ionicons
                name={consistencyLast7 >= 70 ? 'flash' : consistencyLast7 >= 50 ? 'warning' : 'alert-circle'}
                size={20}
                color={consistencyLast7 >= 70 ? Colors.blue[300] : Colors.danger}
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

  statGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    gap: 4,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { ...Typography.bodySmall, color: Colors.textSecondary },

  sectionCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  chartCaption: { fontSize: 10.5, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },

  realityCard: {
    borderRadius: BorderRadius.lg, overflow: 'hidden',
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.danger + '33',
  },
  realityGradient: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  realityMessage: { flex: 1, ...Typography.bodyMedium, color: Colors.textSecondary, lineHeight: 20 },
});
