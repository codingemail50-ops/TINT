import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { AppState } from '../utils/storage';
import { getConsistencyData } from '../utils/storage';
import { ConsistencyGraph } from '../components/ConsistencyGraph';
import { StreakFlame } from '../components/StreakFlame';
import { REALITY_CHECK_MESSAGES } from '../data/examPresets';

interface Props {
  appState: AppState;
}

export const ProductivityScreen: React.FC<Props> = ({ appState }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'youVsYou'>('stats');
  const tabAnim = useRef(new Animated.Value(0)).current;
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(4)].map(() => new Animated.Value(0))).current;

  const consistencyData = getConsistencyData(appState.history);
  const avg = consistencyData.length > 0
    ? Math.round(consistencyData.reduce((s, d) => s + d.value, 0) / consistencyData.length)
    : 0;

  const realityCheck = REALITY_CHECK_MESSAGES.find(r => avg <= r.threshold) ?? REALITY_CHECK_MESSAGES[REALITY_CHECK_MESSAGES.length - 1];

  useEffect(() => {
    Animated.timing(headerFadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.stagger(100, cardAnims.map(a => Animated.spring(a, { toValue: 1, useNativeDriver: true }))).start();
  }, []);

  const switchTab = (tab: 'stats' | 'youVsYou') => {
    setActiveTab(tab);
    Animated.timing(tabAnim, {
      toValue: tab === 'stats' ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const statCards = [
    { label: 'Current Streak', value: appState.streak, unit: 'days', icon: '🔥', color: Colors.accent },
    { label: 'Best Streak', value: appState.longestStreak, unit: 'days', icon: '🏅', color: Colors.primary },
    { label: 'Tasks Done', value: appState.totalTasksCompleted, unit: 'total', icon: '✅', color: Colors.success },
    { label: '7-Day Avg', value: avg, unit: '%', icon: '📊', color: avg >= 70 ? Colors.success : avg >= 40 ? Colors.accent : Colors.danger },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0A0015', '#080810']} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerFadeAnim }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.screenTitle}>Your Progress</Text>
              <Text style={styles.screenSub}>Every day counts. Here's the truth.</Text>
            </View>
            <StreakFlame streak={appState.streak} size="sm" />
          </View>
        </Animated.View>

        {/* Stat grid */}
        <View style={styles.statGrid}>
          {statCards.map((card, i) => (
            <Animated.View
              key={i}
              style={[
                styles.statCard,
                {
                  opacity: cardAnims[i],
                  transform: [{ scale: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
                },
              ]}
            >
              <Text style={styles.statIcon}>{card.icon}</Text>
              <Text style={[styles.statValue, { color: card.color }]}>
                {card.value}
                <Text style={styles.statUnit}> {card.unit}</Text>
              </Text>
              <Text style={styles.statLabel}>{card.label}</Text>
              <View style={[styles.statAccent, { backgroundColor: card.color }]} />
            </Animated.View>
          ))}
        </View>

        {/* Reality check */}
        {avg < 95 && (
          <Animated.View
            style={[
              styles.realityCard,
              { opacity: cardAnims[0] },
            ]}
          >
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
          </Animated.View>
        )}

        {/* Tab switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
            onPress={() => switchTab('stats')}
          >
            <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
              Consistency
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'youVsYou' && styles.tabActive]}
            onPress={() => switchTab('youVsYou')}
          >
            <Text style={[styles.tabText, activeTab === 'youVsYou' && styles.tabTextActive]}>
              You vs You
            </Text>
          </TouchableOpacity>
        </View>

        {/* Graph */}
        <View style={styles.graphSection}>
          {activeTab === 'stats' ? (
            <ConsistencyGraph
              actualData={consistencyData}
              title="Past 7 Days"
              showYouVsYou={false}
            />
          ) : (
            <ConsistencyGraph
              actualData={consistencyData}
              idealData={consistencyData.map(d => ({ ...d, value: 100 }))}
              title="You vs Your Best Self"
              showYouVsYou={true}
            />
          )}
        </View>

        {/* Insights */}
        {appState.history.length > 0 && (
          <View style={styles.insightsSection}>
            <Text style={styles.insightsTitle}>Insights</Text>
            {avg >= 80 && (
              <InsightRow icon="🔥" text={`You're in the top consistency bracket. ${appState.streak} days straight — don't stop.`} positive />
            )}
            {avg >= 50 && avg < 80 && (
              <InsightRow icon="📈" text="You're building momentum. Push past 80% to lock in your habit." />
            )}
            {avg < 50 && avg > 0 && (
              <InsightRow icon="⏰" text="Under 50% consistency. Every missed day compounds. Start with just 1 task today." negative />
            )}
            {appState.streak >= 7 && (
              <InsightRow icon="🏆" text={`${appState.streak}-day streak! You're in the top 10% of users.`} positive />
            )}
            {appState.totalTasksCompleted > 0 && (
              <InsightRow icon="✅" text={`${appState.totalTasksCompleted} tasks completed across your journey. Keep stacking.`} positive />
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
    insightStyles.row,
    positive && { borderColor: Colors.success + '44', backgroundColor: Colors.successGlow },
    negative && { borderColor: Colors.danger + '44', backgroundColor: Colors.dangerGlow },
  ]}>
    <Text style={{ fontSize: 18 }}>{icon}</Text>
    <Text style={insightStyles.text}>{text}</Text>
  </View>
);

const insightStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  header: {
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.lg,
    marginHorizontal: -Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  screenSub: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
    overflow: 'hidden',
  },
  statIcon: { fontSize: 22, marginBottom: 2 },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  statUnit: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  statLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  statAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.6,
  },
  realityCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.danger + '33',
  },
  realityGradient: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  realityIcon: { fontSize: 22 },
  realityTitle: {
    ...Typography.labelLarge,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  realityMessage: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  graphSection: { marginBottom: Spacing.md },
  insightsSection: { marginBottom: Spacing.md },
  insightsTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
});
