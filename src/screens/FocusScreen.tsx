import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Alert,
  Animated, AppState as RNAppState, AppStateStatus, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';
import { syncFocusLog } from '../utils/supabaseStorage';
import { StorageService } from '../utils/storage';
import { FocusLogEntry, loadFocusLog, saveFocusLog, computeFocusStats } from '../utils/focusLog';
import { PixelFlame } from '../components/PixelFlame';
import { FlameBadge } from '../components/FlameBadge';

const DURATIONS = [15, 25, 45, 60, 90];
const DEFAULT_DURATION = 25;
const HOLD_MS = 3000;

const FOCUS_APPS: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
  { id: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
  { id: 'tiktok', label: 'TikTok', icon: 'logo-tiktok' },
  { id: 'twitter', label: 'Twitter / X', icon: 'logo-twitter' },
  { id: 'reddit', label: 'Reddit', icon: 'logo-reddit' },
  { id: 'snapchat', label: 'Snapchat', icon: 'logo-snapchat' },
];
const DEFAULT_BLOCKED_APPS = ['instagram', 'youtube', 'tiktok'];

const KEYS = {
  BLOCKED_APPS: 'tint_blocked_apps',
};

// Scalloped blob outline — same wavy-radius technique agreed on in the mockups.
// Returns both the path string and its points, so callers can measure its
// actual perimeter (react-native-svg has no `pathLength` normalization —
// unlike web SVG, it strokes in real path units, so dasharray/dashoffset
// need the real length, not an assumed 0-100 scale).
function scallopPath(cx: number, cy: number, rBase: number, bumps = 15, amp = 5, n = 120) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI;
    const r = rBase + amp * Math.sin(bumps * t);
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  const d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} ` +
    pts.slice(1).map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  length += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return { d, length };
}

const BLOB_SIZE = 240;
const BLOB_WRAP = BLOB_SIZE + 24;
const BLOB_R = 86;
const BLOB_AMP = 5;
const BLOB_PATH = scallopPath(BLOB_SIZE / 2, BLOB_SIZE / 2, BLOB_R, 15, BLOB_AMP).d;
const TRACE_SCALLOP = scallopPath(BLOB_SIZE / 2, BLOB_SIZE / 2, BLOB_R + 5, 15, BLOB_AMP);
const TRACE_PATH = TRACE_SCALLOP.d;
const TRACE_LENGTH = TRACE_SCALLOP.length;

const SCREEN_H = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.min(560, SCREEN_H * 0.78);

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const HOLD_BG_RANGE = ['hsl(350, 20%, 25%)', 'hsl(350, 80%, 17%)'];
const HOLD_BORDER_RANGE = ['hsl(350, 40%, 45%)', 'hsl(350, 80%, 35%)'];

interface Props {
  userId?: string;
}

type Phase = 'setup' | 'active' | 'done';

export const FocusScreen: React.FC<Props> = ({ userId }) => {
  const [phase, setPhase] = useState<Phase>('setup');
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATION * 60);
  const [paused, setPaused] = useState(false);
  const [streak, setStreak] = useState(0);

  const [blockedApps, setBlockedApps] = useState<string[]>(DEFAULT_BLOCKED_APPS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([]);

  const endTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPausedBeforeConfirm = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const { taskComplete, buttonPress } = useHaptics();

  const holdAnim = useRef(new Animated.Value(0)).current;
  const [holdLabel, setHoldLabel] = useState('Hold to end session');

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEYS.BLOCKED_APPS);
        if (raw) setBlockedApps(JSON.parse(raw));
        else await AsyncStorage.setItem(KEYS.BLOCKED_APPS, JSON.stringify(DEFAULT_BLOCKED_APPS));
      } catch {}
      setFocusLog(await loadFocusLog());
      const state = await StorageService.getAppState();
      setStreak(state.streak);
    })();
  }, []);

  useEffect(() => {
    Animated.timing(sheetY, {
      toValue: sheetOpen ? 0 : SHEET_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [sheetOpen, sheetY]);

  const finishSession = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    endTimeRef.current = 0;
    setTimeLeft(0);
    setPhase('done');

    const entry: FocusLogEntry = { date: new Date().toDateString(), mins: duration };
    const updatedLog = [...(await loadFocusLog()), entry];
    await saveFocusLog(updatedLog);
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
      if (state === 'active' && endTimeRef.current > 0 && !paused) {
        tick();
      }
    };
    const sub = RNAppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [tick, paused]);

  useEffect(() => {
    if (phase === 'active' && !paused) {
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      };
    }
  }, [phase, paused, tick]);

  const resetToSetup = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    endTimeRef.current = 0;
    setPaused(false);
    setConfirmOpen(false);
    setSheetOpen(false);
    setTimeLeft(duration * 60);
    setPhase('setup');
  }, [duration]);

  const handleStart = async () => {
    await buttonPress();
    endTimeRef.current = Date.now() + duration * 60 * 1000;
    setTimeLeft(duration * 60);
    setPaused(false);
    setPhase('active');
  };

  const handleStartAnother = async () => {
    await buttonPress();
    setTimeLeft(duration * 60);
    setPhase('setup');
  };

  const togglePause = async () => {
    await buttonPress();
    if (paused) {
      endTimeRef.current = Date.now() + timeLeft * 1000;
      setPaused(false);
    } else {
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      setPaused(true);
    }
  };

  const openConfirm = async () => {
    await buttonPress();
    wasPausedBeforeConfirm.current = paused;
    setPaused(true);
    setConfirmOpen(true);
  };

  const closeConfirm = async () => {
    await buttonPress();
    setConfirmOpen(false);
    setPaused(wasPausedBeforeConfirm.current);
  };

  // Driven by Animated (not per-frame setState) so the color build-up runs
  // on its own timing loop instead of forcing a full component re-render
  // ~60x/second — that churn was resetting the native touch responder
  // mid-hold on-device, cutting the gesture short before the 3s completed.
  const startHold = () => {
    setHoldLabel('Hold to end session');
    holdAnim.setValue(0);
    Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setHoldLabel('Session ended');
        resetToSetup();
      }
    });
  };

  const cancelHold = () => {
    holdAnim.stopAnimation();
    Animated.timing(holdAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  const toggleBlockedApp = async (id: string) => {
    await buttonPress();
    const updated = blockedApps.includes(id)
      ? blockedApps.filter(a => a !== id)
      : [...blockedApps, id];
    setBlockedApps(updated);
    try { await AsyncStorage.setItem(KEYS.BLOCKED_APPS, JSON.stringify(updated)); } catch {}
  };

  const addCustomApp = () => {
    Alert.alert(
      'Add custom apps',
      'Blocking any app you choose needs system-level permission (Screen Time / Accessibility Service), which requires a native build. Coming soon.'
    );
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-25, 25])
    .onEnd(event => {
      'worklet';
      if (event.translationY < -50) runOnJS(setSheetOpen)(true);
      else if (event.translationY > 50) runOnJS(setSheetOpen)(false);
    });

  const stats = computeFocusStats(focusLog);

  const totalSeconds = duration * 60;
  const pct = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const traceDashoffset = TRACE_LENGTH * (1 - pct);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {phase !== 'active' && (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Focus</Text>
          <Text style={styles.subtitle}>Deep work, distraction-free.</Text>

          {phase === 'setup' && (
            <>
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

              <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.8}>
                <Text style={styles.startBtnText}>Start Focus Session</Text>
              </TouchableOpacity>

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

          {phase === 'done' && (
            <View style={styles.doneWrapper}>
              <PixelFlame size={64} state="static" style={styles.doneIcon} />
              <Text style={styles.doneTitle}>Session Complete!</Text>
              <Text style={styles.doneSub}>{duration} minutes of pure focus.</Text>
              <TouchableOpacity style={styles.startBtn} onPress={handleStartAnother} activeOpacity={0.8}>
                <Text style={styles.startBtnText}>Start Another</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.ScrollView>
      )}

      {phase === 'active' && (
        <GestureDetector gesture={swipeGesture}>
          <View style={styles.activeScreen}>
            <View style={styles.topBar}>
              <Text style={styles.wordmark}>There is no tomorrow</Text>
              <View style={styles.topRight}>
                <FlameBadge streak={streak} size={38} />
                <TouchableOpacity style={styles.closeBtn} onPress={openConfirm} activeOpacity={0.7}>
                  <Ionicons name="close" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.hero}>
              <View style={styles.blobWrap}>
                <Svg width={BLOB_WRAP} height={BLOB_WRAP} viewBox={`0 0 ${BLOB_SIZE} ${BLOB_SIZE}`}>
                  <Path d={BLOB_PATH} fill={Colors.blue[100]} />
                  <Path
                    d={TRACE_PATH}
                    fill="none"
                    stroke={Colors.blue[500]}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray={TRACE_LENGTH}
                    strokeDashoffset={traceDashoffset}
                  />
                </Svg>
                <View style={styles.blobContent}>
                  <Text style={styles.blobTask}>Focus Session</Text>
                  <Text style={styles.blobTime}>{formatMMSS(timeLeft)}</Text>
                  <TouchableOpacity style={styles.pauseCircle} onPress={togglePause} activeOpacity={0.75}>
                    <Ionicons name={paused ? 'play' : 'pause'} size={20} color={Colors.blue[100]} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {!sheetOpen && (
              <View style={styles.swipeHint} pointerEvents="none">
                <Ionicons name="chevron-up" size={16} color={Colors.textMuted} />
                <Text style={styles.swipeHintText}>Swipe up for blocked apps</Text>
              </View>
            )}
          </View>
        </GestureDetector>
      )}

      {confirmOpen && (
        <View style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={['rgba(6,6,8,0.2)', 'rgba(20,4,8,0.55)', 'rgba(30,4,10,0.92)']}
            locations={[0, 0.45, 1]}
            style={styles.confirmOverlay}
          >
            <TouchableOpacity style={styles.confirmClose} onPress={closeConfirm} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <Text style={styles.confirmTimer}>{formatMMSS(timeLeft)}</Text>

            <View style={styles.confirmSheet}>
              <View style={styles.confirmIcon}>
                <Ionicons name="exit-outline" size={20} color={Colors.danger} />
              </View>
              <Text style={styles.confirmTitle}>Leave early?</Text>
              <Text style={styles.confirmSub}>Don't give up — there's a reason you started this.</Text>

              <AnimatedPressable
                style={[styles.holdBtn, {
                  backgroundColor: holdAnim.interpolate({ inputRange: [0, 1], outputRange: HOLD_BG_RANGE }),
                  borderColor: holdAnim.interpolate({ inputRange: [0, 1], outputRange: HOLD_BORDER_RANGE }),
                }]}
                onPressIn={startHold}
                onPressOut={cancelHold}
              >
                <Text style={styles.holdLabel}>{holdLabel}</Text>
              </AnimatedPressable>

              <TouchableOpacity onPress={closeConfirm} activeOpacity={0.7}>
                <Text style={styles.neverMind}>Never mind</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {phase === 'active' && (
        <Animated.View
          style={[styles.appsSheet, { transform: [{ translateY: sheetY }] }]}
          pointerEvents={sheetOpen ? 'auto' : 'none'}
        >
          <View style={styles.appsHandle} />
          <Text style={styles.appsTitle}>Blocked Apps</Text>
          <Text style={styles.appsSub}>Stay away from these while this session runs.</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {FOCUS_APPS.map(app => {
              const on = blockedApps.includes(app.id);
              return (
                <TouchableOpacity
                  key={app.id}
                  style={styles.appRow}
                  onPress={() => toggleBlockedApp(app.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={app.icon} size={20} color={Colors.textPrimary} />
                  <Text style={styles.appName}>{app.label}</Text>
                  <View style={[styles.appToggle, on && styles.appToggleOn]}>
                    <View style={[styles.appToggleDot, on && styles.appToggleDotOn]} />
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.addAppRow} onPress={addCustomApp} activeOpacity={0.7}>
              <View style={styles.addAppIcon}>
                <Ionicons name="add" size={14} color={Colors.blue[400]} />
              </View>
              <Text style={styles.addAppText}>Add app to block</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      )}
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

  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  startBtnText: { ...Typography.headlineSmall, color: Colors.background, fontSize: 16 },

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

  // ── Active phase ──────────────────────────────────────────────────────────
  activeScreen: { flex: 1, paddingTop: 56, paddingHorizontal: Spacing.lg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: {
    fontFamily: Fonts.display, fontSize: 14, color: Colors.blue[400],
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 9,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blobWrap: { width: BLOB_WRAP, height: BLOB_WRAP, alignItems: 'center', justifyContent: 'center' },
  blobContent: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 4 },
  blobTask: {
    fontSize: 12, fontWeight: '700', color: Colors.blue[700],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  blobTime: { fontFamily: Fonts.retro, fontSize: 40, color: Colors.ink, letterSpacing: 1, marginBottom: 10 },
  pauseCircle: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center',
  },

  swipeHint: { alignItems: 'center', gap: 2, paddingBottom: 30 },
  swipeHintText: { fontSize: 10.5, color: Colors.textMuted },

  // ── Hold-to-end confirm overlay ──────────────────────────────────────────
  confirmOverlay: { flex: 1, justifyContent: 'flex-end' },
  confirmClose: { position: 'absolute', top: 24, right: 22 },
  confirmTimer: {
    position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center',
    fontFamily: Fonts.retro, fontSize: 46, color: 'rgba(255,255,255,0.5)',
  },
  confirmSheet: {
    backgroundColor: 'rgba(20,6,10,0.75)',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderTopColor: 'rgba(240,89,107,0.3)',
    paddingHorizontal: 26, paddingTop: 28, paddingBottom: 34,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.5, borderColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  confirmSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 22 },
  holdBtn: {
    width: '100%', paddingVertical: 15, borderRadius: 999,
    borderWidth: 1.5, alignItems: 'center',
  },
  holdLabel: { fontFamily: Fonts.retro, fontSize: 16, letterSpacing: 0.5, color: Colors.textPrimary },
  neverMind: { fontSize: 13, color: Colors.textSecondary, marginTop: 14 },

  // ── Done phase ────────────────────────────────────────────────────────────
  doneWrapper: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  doneIcon: { marginBottom: Spacing.sm },
  doneTitle: { ...Typography.headlineLarge, color: Colors.textPrimary },
  doneSub: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: Spacing.lg },

  // ── Blocked-apps swipe-up sheet ───────────────────────────────────────────
  appsSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: SHEET_HEIGHT,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1, borderTopColor: Colors.border,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20,
  },
  appsHandle: { width: 38, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  appsTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  appsSub: { fontSize: 12.5, color: Colors.textSecondary, marginBottom: 18 },
  appRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  appName: { flex: 1, fontSize: 14.5, color: Colors.textPrimary },
  appToggle: { width: 40, height: 24, borderRadius: 12, backgroundColor: Colors.border, justifyContent: 'center' },
  appToggleOn: { backgroundColor: Colors.blue[400] },
  appToggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.textPrimary, marginLeft: 3 },
  appToggleDotOn: { marginLeft: 19 },
  addAppRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  addAppIcon: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.blue[400], borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addAppText: { color: Colors.blue[400], fontSize: 14.5 },
});
