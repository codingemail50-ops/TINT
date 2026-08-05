import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Modal, AppState as RNAppState, AppStateStatus,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';
import { syncFocusLog } from '../utils/supabaseStorage';

// ── Constants ─────────────────────────────────────────────────────────────────
const DURATIONS = [15, 25, 45, 60, 90];
const DEFAULT_DURATION = 25;

const FOCUS_APPS: { id: string; label: string; emoji: string }[] = [
  { id: 'instagram', label: 'Instagram', emoji: '📷' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'twitter', label: 'Twitter / X', emoji: '𝕏' },
  { id: 'reddit', label: 'Reddit', emoji: '👽' },
  { id: 'snapchat', label: 'Snapchat', emoji: '👻' },
];
const DEFAULT_BLOCKED_APPS = ['instagram', 'youtube', 'tiktok'];

const KEYS = {
  BLOCKED_APPS: 'tint_blocked_apps',
  FOCUS_LOG: 'tint_focus_log',
};

interface FocusLogEntry {
  date: string;
  mins: number;
}

const RADIUS = 75;
const STROKE_WIDTH = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SVG_SIZE = (RADIUS + STROKE_WIDTH) * 2;

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function loadFocusLog(): Promise<FocusLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.FOCUS_LOG);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const result = new Date(d);
  result.setDate(d.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function computeStats(log: FocusLogEntry[]): { today: number; week: number; allTime: number } {
  const todayStr = new Date().toDateString();
  const weekStart = startOfWeek(new Date());

  let today = 0, week = 0, allTime = 0;
  for (const entry of log) {
    allTime += entry.mins;
    if (entry.date === todayStr) today += entry.mins;
    const entryDate = new Date(entry.date);
    if (!isNaN(entryDate.getTime()) && entryDate >= weekStart) week += entry.mins;
  }
  return { today, week, allTime };
}

// ── Main Screen ───────────────────────────────────────────────────────────────
interface Props {
  userId?: string;
}

type Phase = 'setup' | 'active' | 'done';

export const FocusScreen: React.FC<Props> = ({ userId }) => {
  const [phase, setPhase] = useState<Phase>('setup');
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATION * 60);

  const [blockedApps, setBlockedApps] = useState<string[]>(DEFAULT_BLOCKED_APPS);
  const [showBlockModal, setShowBlockModal] = useState(false);

  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([]);

  const endTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { taskComplete, buttonPress } = useHaptics();

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEYS.BLOCKED_APPS);
        if (raw) setBlockedApps(JSON.parse(raw));
        else await AsyncStorage.setItem(KEYS.BLOCKED_APPS, JSON.stringify(DEFAULT_BLOCKED_APPS));
      } catch {}
      setFocusLog(await loadFocusLog());
    })();
  }, []);

  // ── Timer tick + AppState background/foreground correction ────────────────
  const finishSession = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    endTimeRef.current = 0;
    setTimeLeft(0);
    setPhase('done');

    const entry: FocusLogEntry = { date: new Date().toDateString(), mins: duration };
    const updatedLog = [...(await loadFocusLog()), entry];
    try { await AsyncStorage.setItem(KEYS.FOCUS_LOG, JSON.stringify(updatedLog)); } catch {}
    setFocusLog(updatedLog);

    await taskComplete();

    if (userId) {
      syncFocusLog(userId, updatedLog);
    }
  }, [duration, userId, taskComplete]);

  const tick = useCallback(() => {
    if (endTimeRef.current <= 0) return;
    const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
    setTimeLeft(remaining);
    if (remaining <= 0) {
      finishSession();
    }
  }, [finishSession]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active' && endTimeRef.current > 0) {
        tick();
      }
    };
    const sub = RNAppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [tick]);

  useEffect(() => {
    if (phase === 'active') {
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      };
    }
  }, [phase, tick]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    await buttonPress();
    endTimeRef.current = Date.now() + duration * 60 * 1000;
    setTimeLeft(duration * 60);
    setPhase('active');
  };

  const handleEndSession = async () => {
    await buttonPress();
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    endTimeRef.current = 0;
    setTimeLeft(duration * 60);
    setPhase('setup');
  };

  const handleStartAnother = async () => {
    await buttonPress();
    setTimeLeft(duration * 60);
    setPhase('setup');
  };

  const toggleBlockedApp = async (id: string) => {
    await buttonPress();
    const updated = blockedApps.includes(id)
      ? blockedApps.filter(a => a !== id)
      : [...blockedApps, id];
    setBlockedApps(updated);
    try { await AsyncStorage.setItem(KEYS.BLOCKED_APPS, JSON.stringify(updated)); } catch {}
  };

  const stats = computeStats(focusLog);

  const totalSeconds = duration * 60;
  const pct = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - pct);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Focus</Text>
        <Text style={styles.subtitle}>Deep work, distraction-free.</Text>

        {phase === 'setup' && (
          <>
            {/* Duration chips */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Duration</Text>
              <View style={styles.chipRow}>
                {DURATIONS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, duration === d && styles.chipActive]}
                    onPress={() => { setDuration(d); setTimeLeft(d * 60); buttonPress(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, duration === d && styles.chipTextActive]}>
                      {d}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Distraction block row */}
            <TouchableOpacity
              style={styles.blockRow}
              onPress={() => { setShowBlockModal(true); buttonPress(); }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.blockRowTitle}>🚫 Distraction Block</Text>
                <Text style={styles.blockRowSub}>
                  {blockedApps.length > 0
                    ? `${blockedApps.length} app${blockedApps.length === 1 ? '' : 's'} on your reminder list`
                    : 'No apps selected'}
                </Text>
              </View>
              <Text style={styles.blockRowChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.8}>
              <Text style={styles.startBtnText}>Start Focus Session ⚡</Text>
            </TouchableOpacity>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.today}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.week}</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.allTime}</Text>
                <Text style={styles.statLabel}>All-Time</Text>
              </View>
            </View>
          </>
        )}

        {phase === 'active' && (
          <View style={styles.activeWrapper}>
            <View style={{ width: SVG_SIZE, height: SVG_SIZE }}>
              <Svg width={SVG_SIZE} height={SVG_SIZE}>
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={RADIUS}
                  stroke={Colors.border}
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                />
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={RADIUS}
                  stroke={Colors.primary}
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  rotation={-90}
                  originX={SVG_SIZE / 2}
                  originY={SVG_SIZE / 2}
                />
              </Svg>
              <View style={styles.ringCenter}>
                <Text style={styles.timeText}>{formatMMSS(timeLeft)}</Text>
                <Text style={styles.timeSub}>remaining</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.endBtn} onPress={handleEndSession} activeOpacity={0.7}>
              <Text style={styles.endBtnText}>End Session</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'done' && (
          <View style={styles.doneWrapper}>
            <Text style={styles.doneEmoji}>🔥</Text>
            <Text style={styles.doneTitle}>Session Complete!</Text>
            <Text style={styles.doneSub}>{duration} minutes of pure focus.</Text>
            <TouchableOpacity style={styles.startBtn} onPress={handleStartAnother} activeOpacity={0.8}>
              <Text style={styles.startBtnText}>Start Another</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.ScrollView>

      {/* ── Distraction Block Modal ──────────────────────────────────────────── */}
      <Modal
        visible={showBlockModal}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowBlockModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBlockModal(false)}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Distraction Block</Text>
          <Text style={styles.modalDesc}>
            A personal reminder list — apps to stay away from during this session.
          </Text>

          {FOCUS_APPS.map(app => {
            const active = blockedApps.includes(app.id);
            return (
              <TouchableOpacity
                key={app.id}
                style={styles.appRow}
                onPress={() => toggleBlockedApp(app.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.appEmoji}>{app.emoji}</Text>
                <Text style={styles.appLabel}>{app.label}</Text>
                <View style={[styles.toggle, active && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, active && styles.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.doneBtnModal}
            onPress={() => { setShowBlockModal(false); buttonPress(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.doneBtnModalText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: 56, paddingBottom: Spacing.xxxl },

  title: { ...Typography.displayMedium, color: Colors.textPrimary },
  subtitle: { ...Typography.bodyMedium, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.xl },

  section: { marginBottom: Spacing.lg },
  sectionLabel: { ...Typography.labelSmall, color: Colors.textSecondary, marginBottom: Spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
  chipText: { ...Typography.labelLarge, color: Colors.textSecondary },
  chipTextActive: { color: Colors.primaryLight },

  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  blockRowTitle: { ...Typography.headlineSmall, color: Colors.textPrimary, fontSize: 15 },
  blockRowSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  blockRowChevron: { fontSize: 24, color: Colors.textMuted },

  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  startBtnText: { ...Typography.headlineSmall, color: '#fff', fontSize: 16 },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { ...Typography.headlineLarge, color: Colors.primary },
  statLabel: { ...Typography.labelSmall, color: Colors.textSecondary },

  // Active phase
  activeWrapper: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.xl },
  ringCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: { fontSize: 40, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },
  timeSub: { ...Typography.labelSmall, color: Colors.textSecondary, marginTop: 4 },
  endBtn: {
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  endBtnText: { ...Typography.labelLarge, color: Colors.danger },

  // Done phase
  doneWrapper: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  doneEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  doneTitle: { ...Typography.headlineLarge, color: Colors.textPrimary },
  doneSub: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: Spacing.lg },

  // Modal
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  modalSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: 44,
  },
  modalHandle: {
    width: 36, height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { ...Typography.headlineLarge, color: Colors.textPrimary, marginBottom: 4 },
  modalDesc: { ...Typography.bodySmall, color: Colors.textMuted, marginBottom: Spacing.lg },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  appEmoji: { fontSize: 20, width: 28 },
  appLabel: { ...Typography.bodyLarge, color: Colors.textPrimary, flex: 1 },
  toggle: {
    width: 44, height: 26,
    borderRadius: 13,
    backgroundColor: Colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  doneBtnModal: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  doneBtnModalText: { ...Typography.headlineSmall, color: '#fff', fontSize: 15 },
});
