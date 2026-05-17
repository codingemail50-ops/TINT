import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DataPoint {
  day: string;
  value: number;
}

interface Props {
  actualData: DataPoint[];
  idealData?: DataPoint[];
  showYouVsYou?: boolean;
  title?: string;
}

const BAR_MAX_HEIGHT = 100;

export const ConsistencyGraph: React.FC<Props> = ({
  actualData,
  idealData,
  showYouVsYou = false,
  title = 'This Week',
}) => {
  const barAnims = useRef(actualData.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = barAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: actualData[i]?.value ?? 0,
        duration: 600,
        delay: i * 80,
        useNativeDriver: false,
      })
    );
    Animated.stagger(80, anims).start();
  }, [actualData]);

  const avg = actualData.length > 0
    ? Math.round(actualData.reduce((s, d) => s + d.value, 0) / actualData.length)
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.avgBadge}>
          <Text style={styles.avgText}>{avg}% avg</Text>
        </View>
      </View>

      {showYouVsYou && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.legendLabel}>You Now</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.legendLabel}>You at 100%</Text>
          </View>
        </View>
      )}

      <View style={styles.graphArea}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          {[100, 75, 50, 25, 0].map(v => (
            <Text key={v} style={styles.yLabel}>{v}</Text>
          ))}
        </View>

        {/* Bars */}
        <View style={styles.bars}>
          {actualData.map((point, i) => {
            const heightPct = point.value / 100;
            const isGood = point.value >= 70;
            const isMid = point.value >= 40 && point.value < 70;
            const barColor = isGood ? Colors.primary : isMid ? Colors.accent : Colors.danger;

            return (
              <View key={i} style={styles.barGroup}>
                {showYouVsYou && (
                  <View style={[styles.barIdeal, { height: BAR_MAX_HEIGHT }]} />
                )}
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      height: barAnims[i].interpolate({
                        inputRange: [0, 100],
                        outputRange: [0, BAR_MAX_HEIGHT],
                      }),
                      backgroundColor: barColor,
                      shadowColor: barColor,
                    },
                  ]}
                />
                <Text style={styles.dayLabel}>{point.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {showYouVsYou && (
        <View style={styles.youVsYouCard}>
          <Text style={styles.youVsYouTitle}>You vs You</Text>
          <Text style={styles.youVsYouSub}>
            {avg >= 90
              ? "You're living at your best. Keep it going."
              : avg >= 70
              ? `You're ${100 - avg}% away from your best self every day.`
              : avg >= 50
              ? `Your best self completes ${100 - avg}% more each day. Close the gap.`
              : `Your ideal self is ${100 - avg}% ahead. Every missed task widens that gap.`}
          </Text>
          <View style={styles.gapBar}>
            <View style={[styles.gapFill, { width: `${avg}%` as any, backgroundColor: Colors.primary }]} />
            <View style={[styles.gapIdeal, { width: `${100 - avg}%` as any, backgroundColor: Colors.success + '33' }]} />
          </View>
          <View style={styles.gapLabels}>
            <Text style={styles.gapLabelLeft}>{avg}% you</Text>
            <Text style={styles.gapLabelRight}>{100 - avg}% gap</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
  },
  avgBadge: {
    backgroundColor: Colors.primary + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  avgText: {
    ...Typography.labelSmall,
    color: Colors.primaryLight,
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  graphArea: {
    flexDirection: 'row',
    height: BAR_MAX_HEIGHT + 24,
    gap: Spacing.sm,
  },
  yAxis: {
    justifyContent: 'space-between',
    paddingBottom: 20,
    width: 26,
  },
  yLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'right',
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 4,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    position: 'relative',
    height: BAR_MAX_HEIGHT + 20,
  },
  barIdeal: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    backgroundColor: Colors.success + '18',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.success + '33',
    borderStyle: 'dashed',
  },
  bar: {
    width: '70%',
    borderRadius: 6,
    minHeight: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  dayLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  youVsYouCard: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  youVsYouTitle: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  youVsYouSub: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  gapBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: Colors.border,
  },
  gapFill: {
    height: '100%',
    borderRadius: 4,
  },
  gapIdeal: {
    height: '100%',
  },
  gapLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  gapLabelLeft: {
    ...Typography.bodySmall,
    color: Colors.primaryLight,
    fontSize: 10,
  },
  gapLabelRight: {
    ...Typography.bodySmall,
    color: Colors.success,
    fontSize: 10,
  },
});
