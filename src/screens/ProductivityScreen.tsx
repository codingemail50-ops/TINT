import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { AppState, getConsistencyData, getHeatmapData } from '../utils/storage';
import { ConsistencyGraph } from '../components/ConsistencyGraph';
import { FlameIcon } from '../components/FlameIcon';
import { REALITY_CHECK_MESSAGES, EXAM_TYPES } from '../data/examPresets';

interface Props { appState: AppState }

// ── Heatmap ───────────────────────────────────────────────────────────────────
function heatColor(value: number): string {
  if (value < 0)  return '#13132A'; // no data
  if (value === 0) return '#1E1E35';
  if (value < 40)  return '#14532D';
  if (value < 70)  return '#166534';
  if (value < 90)  return '#15803D';
  return '#22C55E';
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const HeatmapGrid: React.FC<{ history: AppState['history'] }> = ({ history }) => {
  const data = useMemo(() => getHeatmapData(history), [history]);

  // Build week columns
  const d0 = new Date();
  d0.setDate(d0.getDate() - 69);
  const startDow = d0.getDay(); // 0=Sun

  const numCols = Math.ceil((startDow + 70) / 7);
  const grid: (number | null)[][] = [];
  for (let col = 0; col < numCols; col++) {
    const cells: (number | null)[] = [];
    for (let row = 0; row < 7; row++) {
      const linear = col * 7 + row;
      const di = linear - startDow;
      cells.push(di >= 0 && di < 70 ? di : null);
    }
    grid.push(cells);
  }

  const CELL = 13;
  const GAP  = 3;

  return (
    <View style={heatSt.wrapper}>
      {/* Day labels column */}
      <View style={[heatSt.dayLabels, { gap: GAP }]}>
        {DAY_LABELS.map((d, i) => (
          <View key={i} style={{ height: CELL, justifyContent: 'center' }}>
            <Text style={heatSt.dayLabel}>{i % 2 === 1 ? d : ''}</Text>
          </View>
        ))}
      </View>

      {/* Cells */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[heatSt.grid, { gap: GAP }]}>
          {grid.map((col, ci) => (
            <View key={ci} style={[heatSt.col, { gap: GAP }]}>
              {col.map((di, row) => (
                <View
                  key={row}
                  style={[
                    heatSt.cell,
                    {
                      width: CELL, height: CELL,
                      backgroundColor: di !== null ? heatColor(data[di]?.value ?? -1) : 'transparent',
                    },
                  ]}
                />
              ))}
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
  col:  { flexDirection: 'column' },
  cell: { borderRadius: 2 },
});

// ── Legend ────────────────────────────────────────────────────────────────────
const HeatmapLegend = () => (
  <View style={legendSt.row}>
    <Text style={legendSt.label}>Less</Text>
    {[-1, 0, 39, 69, 89, 100].map((v, i) => (
      <View key={i} style={[legendSt.cell, { backgroundColor: heatColor(v) }]} />
    ))}
    <Text style={legendSt.label}>More</Text>
  </View>
);
const legendSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  cell: { width: 10, height: 10, borderRadius: 2 },
  label: { fontSize: 9, color: Colors.textMuted },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export const ProductivityScreen: React.FC<Props> = ({ appState }) => {
  const [graphTab, setGraphTab] = useState<'week' | 'vsself'>('week');
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims  = useRef([...Array(4)].map(() => new Animated.Value(0))).current;

  const consistencyData = getConsistencyData(appState.history);
  const avg = consistencyData.length > 0
    ? Math.round(consistencyData.reduce((s, d) => s + d.value, 0) / consistencyData.length)
    : 0;

  const realityCheck = REALITY_CHECK_MESSAGES.find(r => avg <= r.threshold)
    ?? REALITY_CHECK_MESSAGES[REALITY_CHECK_MESSAGES.length - 1];

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.stagger(80, cardAnims.map(a =>
      Animated.spring(a, { toValue: 1, useNativeDriver: true })
    )).start();
  }, []);

  const statCards = [
    { label: 'Current Streak', value: appState.streak,              unit: 'days',  icon: '🔥', color: Colors.accent },
    { label: 'Best Streak',    value: appState.longestStreak,        unit: 'days',  icon: '🏅', color: Colors.primary },
    { label: 'Tasks Done',     value: appState.totalTasksCompleted,  unit: 'total', icon: '✅', color: Colors.success },
    {
      label: '7-Day Avg',      value: avg,                           unit: '%',     icon: '📊',
      color: avg >= 70 ? Colors.success : avg >= 40 ? Colors.accent : Colors.danger,
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0A0015', '#080810']} style={StyleSheet.absoluteFill} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerAnim }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.screenTitle}>Your Progress</Text>
              <Text style={styles.screenSub}>Every day counts. Here's the truth.</Text>
            </View>
            <FlameIcon streak={appState.streak} consistency={avg} size={52} />
          </View>
        </Animated.View>

        {/* Stat cards */}
        <View style={styles.statGrid}>
          {statCards.map((card, i) => (
            <Animated.View key={i} style={[
              styles.statCard,
              {
                opacity:   cardAnims[i],
                transform: [{ scale: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
              },
            ]}>
              <Text style={styles.statIcon}>{card.icon}</Text>
              <Text style={[styles.statValue, { color: card.color }]}>
                {card.value}<Text style={styles.statUnit}> {card.unit}</Text>
              </Text>
              <Text style={styles.statLabel}>{card.label}</Text>
              <View style={[styles.statAccent, { backgroundColor: card.color }]} />
            </Animated.View>
          ))}
        </View>

        {/* Reality check */}
        {avg < 95 && (
          <View style={styles.realityCard}>
            <LinearGradient
              colors={avg >= 70 ? [Colors.primaryGlow, Colors.surface] : [Colors.dangerGlow, Colors.surface]}
              style={styles.realityGradient}
            >
              <Text style={styles.realityIcon}>{avg >= 70 ? '⚡' : avg >= 50 ? '⚠️' : '🚨'}</Text>
              <Text style={[styles.realityTitle, { color: avg >= 70 ? Colors.primaryLight : Colors.danger }]}>
                Reality Check
              </Text>
              <Text style={styles.realityMessage}>{realityCheck.message}</Text>
            </LinearGradient>
          </View>
        )}

        {/* 70-day heatmap */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Consistency Heatmap</Text>
            <Text style={styles.sectionSub}>Past 70 days</Text>
          </View>
          <HeatmapGrid history={appState.history} />
          <View style={{ marginTop: 8 }}>
            <HeatmapLegend />
          </View>
          <View style={styles.heatmapLegendRows}>
            {[
              { color: heatColor(-1),  label: 'No data' },
              { color: heatColor(0),   label: '0% — tracked, nothing done' },
              { color: heatColor(39),  label: '<40% consistency' },
              { color: heatColor(69),  label: '40–70% consistency' },
              { color: heatColor(89),  label: '70–90% consistency' },
              { color: heatColor(100), label: '90–100% — great day' },
            ].map((item, i) => (
              <View key={i} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 7-day graph */}
        <View style={styles.sectionCard}>
          <View style={styles.tabRow}>
            {(['week', 'vsself'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, graphTab === tab && styles.tabActive]}
                onPress={() => setGraphTab(tab)}
              >
                <Text style={[styles.tabText, graphTab === tab && styles.tabTextActive]}>
                  {tab === 'week' ? '7-Day Trend' : 'You vs Best Self'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ConsistencyGraph
            actualData={consistencyData}
            idealData={graphTab === 'vsself' ? consistencyData.map(d => ({ ...d, value: 100 })) : undefined}
            title={graphTab === 'week' ? 'Past 7 Days' : 'You vs Your Best Self'}
            showYouVsYou={graphTab === 'vsself'}
          />
        </View>

        {/* Insights */}
        {appState.history.length > 0 && (
          <View style={styles.insightsSection}>
            <Text style={styles.insightsTitle}>Insights</Text>
            {avg >= 80 && (
              <InsightRow icon="🔥" text={`Top consistency bracket — ${appState.streak} days straight. Don't stop.`} positive />
            )}
            {avg >= 50 && avg < 80 && (
              <InsightRow icon="📈" text="Building momentum. Push past 80% to lock in the habit." />
            )}
            {avg < 50 && avg > 0 && (
              <InsightRow icon="⏰" text="Under 50% consistency. Every missed day compounds. Start with just 1 task today." negative />
            )}
            {appState.streak >= 7 && (
              <InsightRow icon="🏆" text={`${appState.streak}-day streak. That's discipline.`} positive />
            )}
            {appState.totalTasksCompleted > 0 && (
              <InsightRow icon="✅" text={`${appState.totalTasksCompleted} tasks completed. Keep stacking.`} positive />
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const InsightRow: React.FC<{ icon: string; text: string; positive?: boolean; negative?: boolean }> = ({ icon, text, positive, negative }) => (
  <View style={[
    insightSt.row,
    positive  && { borderColor: Colors.success + '44', backgroundColor: Colors.successGlow },
    negative  && { borderColor: Colors.danger + '44',  backgroundColor: Colors.dangerGlow },
  ]}>
    <Text style={{ fontSize: 18 }}>{icon}</Text>
    <Text style={insightSt.text}>{text}</Text>
  </View>
);

const insightSt = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: { flex: 1, ...Typography.bodyMedium, color: Colors.textSecondary, lineHeight: 22 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll:    { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },

  header: {
    paddingTop: 56, paddingBottom: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: Spacing.lg,
    marginHorizontal: -Spacing.xl, paddingHorizontal: Spacing.xl,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  screenTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  screenSub:   { ...Typography.bodyMedium, color: Colors.textSecondary, marginTop: 4 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    width: '47.5%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    gap: 4, overflow: 'hidden',
  },
  statIcon:  { fontSize: 22, marginBottom: 2 },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  statUnit:  { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  statLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  statAccent: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, opacity: 0.6,
  },

  realityCard: {
    borderRadius: BorderRadius.lg, overflow: 'hidden',
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.danger + '33',
  },
  realityGradient: { padding: Spacing.md, gap: Spacing.xs },
  realityIcon:    { fontSize: 22 },
  realityTitle:   { ...Typography.labelLarge, letterSpacing: 1, textTransform: 'uppercase' },
  realityMessage: { ...Typography.bodyMedium, color: Colors.textSecondary, lineHeight: 22 },

  // Heatmap card
  sectionCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  sectionTitle: { ...Typography.headlineSmall, color: Colors.textPrimary },
  sectionSub:   { ...Typography.bodySmall, color: Colors.textMuted },

  heatmapLegendRows: { marginTop: Spacing.sm, gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { ...Typography.bodySmall, color: Colors.textMuted, fontSize: 11 },

  // Graph tab
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: 3,
    marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: BorderRadius.sm - 2 },
  tabActive: { backgroundColor: Colors.primary },
  tabText:   { ...Typography.labelSmall, color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },

  insightsSection: { marginBottom: Spacing.md },
  insightsTitle:   { ...Typography.headlineSmall, color: Colors.textPrimary, marginBottom: Spacing.sm },
});
