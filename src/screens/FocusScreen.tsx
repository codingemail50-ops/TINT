import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, Alert,
  Animated, AppState as RNAppState, AppStateStatus,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius, Typography, Fonts } from '../constants/theme';
import { useHaptics } from '../hooks/useHaptics';
import { syncFocusLog } from '../utils/supabaseStorage';
import { StorageService } from '../utils/storage';
import { FocusLogEntry, loadFocusLog, saveFocusLog, computeFocusStats, subscribeFocusLog } from '../utils/focusLog';
import { loadDistractionLog, saveDistractionLog } from '../utils/distractionLog';
import { saveActiveSession, loadActiveSession, clearActiveSession } from '../utils/activeFocusSession';
import { useFocusSessionStatus } from '../context/FocusSessionContext';
import { now as devNow } from '../utils/devClock';
import { PixelFlame } from '../components/PixelFlame';
import { FlameBadge } from '../components/FlameBadge';
import { BlobDial } from '../components/BlobDial';
import { scallopPath } from '../utils/scallopPath';
import { openPermissionSettings, getSelfReportedGrants, setSelfReportedGrant, BlockingPermission } from '../utils/appBlocking';
import { BLOCKABLE_APPS, DEFAULT_BLOCKED_APPS, BLOCKED_APPS_STORAGE_KEY } from '../data/blockableApps';

const DEFAULT_DURATION = 25;
const HOLD_MS = 2000;

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

const FOCUS_APPS = BLOCKABLE_APPS;

const PERMISSIONS: { id: BlockingPermission; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'usageAccess', label: 'Usage Access', description: 'Lets TINT see which app is open right now.', icon: 'bar-chart-outline' },
  { id: 'accessibility', label: 'Accessibility', description: 'Lets TINT close a blocked app the moment it opens.', icon: 'shield-checkmark-outline' },
  { id: 'overlay', label: 'Display over other apps', description: 'Lets TINT show a block screen over the app.', icon: 'layers-outline' },
];

const KEYS = {
  BLOCKED_APPS: BLOCKED_APPS_STORAGE_KEY,
};

const BLOB_SIZE = 240;
const BLOB_WRAP = BLOB_SIZE + 24;
const BLOB_R = 86;
const BLOB_AMP = 5;
const BLOB_PATH = scallopPath(BLOB_SIZE / 2, BLOB_SIZE / 2, BLOB_R, 15, BLOB_AMP).d;
const TRACE_SCALLOP = scallopPath(BLOB_SIZE / 2, BLOB_SIZE / 2, BLOB_R + 5, 15, BLOB_AMP);
const TRACE_PATH = TRACE_SCALLOP.d;
const TRACE_LENGTH = TRACE_SCALLOP.length;

// AppNavigator's bottom tab bar is always painted on top of whatever screen
// is showing (it's a sibling rendered after the screen content, not part of
// it), and FocusScreen is never shown without it — either as the Focus tab
// itself, or as Today's task-linked overlay, both of which sit under the
// same persistent tab bar. Anything anchored to the bottom of this screen
// needs this much extra clearance or the tab bar paints over it.
const TAB_BAR_CLEARANCE = 100;

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const HOLD_BG_RANGE = ['hsl(350, 20%, 25%)', 'hsl(350, 80%, 17%)'];
const HOLD_BORDER_RANGE = ['hsl(350, 40%, 45%)', 'hsl(350, 80%, 35%)'];

interface ExternalTask {
  title: string;
  durationMins: number;
  /** Task id, so an app-kill-and-relaunch mid-session can be routed back
   *  to the right task's overlay on Today. */
  id?: string;
}

interface Props {
  userId?: string;
  /** When set, the screen skips the setup phase entirely and auto-starts a
   *  session for this task (used by the Today screen's "tap a task" flow —
   *  the same squiggly-circle Focus UI, just pre-loaded and running). */
  externalTask?: ExternalTask;
  /** Natural completion of an externalTask session — parent marks the task done. */
  onExternalFinish?: (actualSeconds: number) => void;
  /** Leaving an externalTask session — early exit (actualSeconds > 0, not
   *  yet logged by the caller, wasNaturalCompletion=false) or dismissing
   *  the "session complete" screen after a natural finish (already logged,
   *  wasNaturalCompletion=true). */
  onExternalExit?: (actualSeconds: number, wasNaturalCompletion: boolean) => void;
  /** Whether this instance is the on-screen UI right now. When false the
   *  screen stays mounted — so its timer keeps running — but is hidden;
   *  AppNavigator shows the mini-player instead. Defaults to true so
   *  existing single-instance usage is unaffected. */
  visible?: boolean;
  /** Which shared-status slot this instance reports to, so the mini-player
   *  can tell whether the full UI for the active session is already
   *  showing elsewhere. */
  sessionSource?: 'tab' | 'task';
}

type Phase = 'setup' | 'active' | 'done';

export const FocusScreen: React.FC<Props> = ({
  userId, externalTask, onExternalFinish, onExternalExit, visible = true, sessionSource = 'tab',
}) => {
  const [phase, setPhase] = useState<Phase>(externalTask ? 'active' : 'setup');
  const [duration, setDuration] = useState(externalTask?.durationMins ?? DEFAULT_DURATION);
  const [timeLeft, setTimeLeft] = useState((externalTask?.durationMins ?? DEFAULT_DURATION) * 60);
  const [paused, setPaused] = useState(false);
  const [streak, setStreak] = useState(0);

  const [blockedApps, setBlockedApps] = useState<string[]>(DEFAULT_BLOCKED_APPS);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([]);

  const endTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPausedBeforeConfirm = useRef(false);
  // Time the app spent backgrounded while a session was actively running —
  // the one "distracted" signal we can measure honestly without a native
  // module (see distractionLog.ts).
  const distractedSecondsRef = useRef(0);
  const backgroundedAtRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>(phase);
  const pausedRef = useRef(paused);
  phaseRef.current = phase;
  pausedRef.current = paused;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dialFadeAnim = useRef(new Animated.Value(1)).current;
  const blobEnterAnim = useRef(new Animated.Value(1)).current;
  const { taskComplete, buttonPress } = useHaptics();
  const { setStatus } = useFocusSessionStatus();
  const bootstrappedRef = useRef(false);

  const holdAnim = useRef(new Animated.Value(0)).current;
  const [holdLabel, setHoldLabel] = useState('Hold to end session');

  const [grants, setGrants] = useState<Record<BlockingPermission, boolean>>({
    usageAccess: false, accessibility: false, overlay: false,
  });

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
      setGrants(await getSelfReportedGrants());
    })();
  }, []);

  // Today stays mounted alongside this tab now — a task-linked session
  // completed there should update this screen's Today/Week/All-Time stat
  // cards too, even though this instance never wrote that data itself.
  useEffect(() => subscribeFocusLog(() => { loadFocusLog().then(setFocusLog); }), []);

  // Takes the completed duration explicitly rather than reading `duration`
  // from closure — needed because the boot-time resume path (below) may
  // call this before a `setDuration` from the same tick has actually
  // committed, and a stale closure there would silently log the wrong
  // amount of time.
  const finishSession = useCallback(async (completedDurationMins: number) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    endTimeRef.current = 0;
    setTimeLeft(0);
    setDuration(completedDurationMins);
    setPhase('done');
    await clearActiveSession();

    const entry: FocusLogEntry = { date: devNow().toDateString(), mins: completedDurationMins, timestamp: devNow().toISOString() };
    const updatedLog = [...(await loadFocusLog()), entry];
    await saveFocusLog(updatedLog);
    setFocusLog(updatedLog);

    const distractedMins = distractedSecondsRef.current / 60;
    distractedSecondsRef.current = 0;
    backgroundedAtRef.current = null;
    if (distractedMins > 0) {
      const distractionLog = await loadDistractionLog();
      await saveDistractionLog([...distractionLog, { date: devNow().toDateString(), mins: distractedMins, timestamp: devNow().toISOString() }]);
    }

    await taskComplete();

    if (userId) {
      syncFocusLog(userId, updatedLog);
    }

    onExternalFinish?.(completedDurationMins * 60);
  }, [userId, taskComplete, onExternalFinish]);

  const tick = useCallback(() => {
    if (endTimeRef.current <= 0) return;
    const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
    setTimeLeft(remaining);
    if (remaining <= 0) {
      finishSession(duration);
    }
  }, [finishSession, duration]);

  // Runs once on mount: resume a session that was still running when the
  // app got killed (matching this instance's source — 'tab' for the Focus
  // tab, 'task' for Today's task-linked overlay), fall back to starting a
  // fresh externalTask session, or do nothing (plain setup screen).
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    (async () => {
      const saved = await loadActiveSession();
      const matches = !!saved && saved.source === sessionSource
        && (sessionSource === 'tab' || saved.taskId === externalTask?.id);

      if (matches && saved) {
        const plannedEnd = saved.startedAtMs + saved.durationMins * 60 * 1000;
        const remaining = Math.max(0, Math.round((plannedEnd - Date.now()) / 1000));
        if (remaining <= 0) {
          endTimeRef.current = 0;
          await finishSession(saved.durationMins);
        } else {
          endTimeRef.current = plannedEnd;
          setDuration(saved.durationMins);
          setTimeLeft(remaining);
          setPaused(false);
          setPhase('active');
        }
        return;
      }

      if (externalTask) {
        endTimeRef.current = Date.now() + externalTask.durationMins * 60 * 1000;
        setTimeLeft(externalTask.durationMins * 60);
        setPhase('active');
        void saveActiveSession({
          source: sessionSource, startedAtMs: Date.now(), durationMins: externalTask.durationMins,
          title: externalTask.title, taskId: externalTask.id,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setStatus({
      active: phase === 'active',
      paused,
      timeLeft,
      title: externalTask?.title ?? 'Focus Session',
      source: phase === 'active' ? sessionSource : null,
    });
  }, [phase, paused, timeLeft, externalTask?.title, sessionSource, setStatus]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        if (backgroundedAtRef.current !== null) {
          distractedSecondsRef.current += (Date.now() - backgroundedAtRef.current) / 1000;
          backgroundedAtRef.current = null;
        }
        if (endTimeRef.current > 0 && !paused) tick();
      } else if (phaseRef.current === 'active' && !pausedRef.current && backgroundedAtRef.current === null) {
        backgroundedAtRef.current = Date.now();
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

  // mode 'early': hold-to-end mid-session — banks whatever time actually
  // ran as a partial focus-log entry instead of discarding it.
  // mode 'afterDone': just dismissing the "session complete" screen —
  // finishSession() already logged everything, nothing more to save.
  const exitSession = useCallback(async (mode: 'early' | 'afterDone') => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    const elapsedSeconds = mode === 'early' ? Math.max(0, duration * 60 - timeLeft) : 0;

    endTimeRef.current = 0;
    setPaused(false);
    setConfirmOpen(false);
    await clearActiveSession();

    if (mode === 'early') {
      const distractedMins = distractedSecondsRef.current / 60;
      if (distractedMins > 0) {
        const distractionLog = await loadDistractionLog();
        await saveDistractionLog([...distractionLog, { date: devNow().toDateString(), mins: distractedMins, timestamp: devNow().toISOString() }]);
      }
      if (elapsedSeconds > 0) {
        const entry: FocusLogEntry = { date: devNow().toDateString(), mins: elapsedSeconds / 60, timestamp: devNow().toISOString() };
        const updatedLog = [...(await loadFocusLog()), entry];
        await saveFocusLog(updatedLog);
        setFocusLog(updatedLog);
        if (userId) syncFocusLog(userId, updatedLog);
      }
    }
    distractedSecondsRef.current = 0;
    backgroundedAtRef.current = null;

    if (externalTask) {
      onExternalExit?.(elapsedSeconds, mode === 'afterDone');
      return;
    }
    setTimeLeft(duration * 60);
    setPhase('setup');
    dialFadeAnim.setValue(1);
  }, [duration, timeLeft, userId, externalTask, onExternalExit, dialFadeAnim]);

  // A quick pixel-flicker on the dial, then a cut to the timer, which
  // materializes in with a small scale/fade — reads as the dial
  // "transforming" into the timer rather than a plain screen swap.
  const handleStart = async () => {
    await buttonPress();
    dialFadeAnim.setValue(1);
    Animated.sequence([
      Animated.timing(dialFadeAnim, { toValue: 0.15, duration: 45, useNativeDriver: true }),
      Animated.timing(dialFadeAnim, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(dialFadeAnim, { toValue: 0.15, duration: 45, useNativeDriver: true }),
      Animated.timing(dialFadeAnim, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(dialFadeAnim, { toValue: 0.15, duration: 45, useNativeDriver: true }),
      Animated.timing(dialFadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      endTimeRef.current = Date.now() + duration * 60 * 1000;
      distractedSecondsRef.current = 0;
      backgroundedAtRef.current = null;
      setTimeLeft(duration * 60);
      setPaused(false);
      setPhase('active');
      void saveActiveSession({ source: sessionSource, startedAtMs: Date.now(), durationMins: duration, title: 'Focus Session' });
      blobEnterAnim.setValue(0);
      Animated.timing(blobEnterAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    });
  };

  const handleStartAnother = async () => {
    await buttonPress();
    setTimeLeft(duration * 60);
    setPhase('setup');
    dialFadeAnim.setValue(1);
  };

  const togglePause = async () => {
    await buttonPress();
    if (paused) {
      endTimeRef.current = Date.now() + timeLeft * 1000;
      setPaused(false);
      void saveActiveSession({
        source: sessionSource,
        startedAtMs: Date.now() - (duration * 60 - timeLeft) * 1000,
        durationMins: duration,
        title: externalTask?.title ?? 'Focus Session',
        taskId: externalTask?.id,
      });
    } else {
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      setPaused(true);
      // While paused there's no wall-clock end time to resume from — clear
      // the descriptor so an app-kill mid-pause doesn't auto-complete or
      // auto-resume a session that was deliberately paused.
      void clearActiveSession();
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
  // mid-hold on-device, cutting the gesture short before HOLD_MS completed.
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
        void exitSession('early');
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
      'Picking any app on your phone (not just this list) needs a native app-picker, which requires a custom build. Coming soon.'
    );
  };

  const handleGrantPermission = async (permission: BlockingPermission) => {
    await buttonPress();
    try {
      await openPermissionSettings(permission);
    } catch {
      Alert.alert('Not available', 'This permission can only be granted on an Android build outside Expo Go.');
    }
  };

  const handleToggleGrant = async (permission: BlockingPermission) => {
    await buttonPress();
    const next = !grants[permission];
    setGrants(prev => ({ ...prev, [permission]: next }));
    await setSelfReportedGrant(permission, next);
  };

  const stats = computeFocusStats(focusLog);

  const totalSeconds = duration * 60;
  const pct = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;
  const traceDashoffset = TRACE_LENGTH * (1 - pct);

  return (
    <View style={[styles.container, !visible && styles.hidden]} pointerEvents={visible ? 'auto' : 'none'}>
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
              <Animated.View style={[styles.dialSection, { opacity: dialFadeAnim }]}>
                <BlobDial
                  size={BLOB_WRAP}
                  minValue={5}
                  maxValue={240}
                  step={5}
                  value={duration}
                  onChange={d => { setDuration(d); setTimeLeft(d * 60); }}
                  formatValue={formatDuration}
                  unitLabel="focus"
                />
              </Animated.View>

              <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.8}>
                <Text style={styles.startBtnText}>Start Focus Session</Text>
              </TouchableOpacity>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{Math.round(stats.today)}</Text>
                  <Text style={styles.statLabel}>Today</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{Math.round(stats.week)}</Text>
                  <Text style={styles.statLabel}>This Week</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{Math.round(stats.allTime)}</Text>
                  <Text style={styles.statLabel}>All-Time</Text>
                </View>
              </View>

              {/* Managed here, before a session starts, instead of a
                  swipe-up sheet mid-session — deciding what to block is a
                  setup decision, not something to fumble with while
                  already trying to focus. */}
              <View style={styles.appsSection}>
                <Text style={styles.appsTitle}>Blocked Apps</Text>
                <Text style={styles.appsSub}>Stay away from these while a session runs.</Text>

                <Text style={styles.permTitle}>Permissions</Text>
                <Text style={styles.permSub}>Grant these once so blocking can actually work on your phone.</Text>
                {PERMISSIONS.map(perm => (
                  <View key={perm.id} style={styles.permRow}>
                    <Ionicons name={perm.icon} size={20} color={Colors.textPrimary} />
                    <View style={styles.permTextWrap}>
                      <Text style={styles.appName}>{perm.label}</Text>
                      <Text style={styles.permDescription}>{perm.description}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleGrantPermission(perm.id)} activeOpacity={0.7}>
                      <Text style={styles.permGrantText}>Grant</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleToggleGrant(perm.id)} activeOpacity={0.7}>
                      <View style={[styles.appToggle, grants[perm.id] && styles.appToggleOn]}>
                        <View style={[styles.appToggleDot, grants[perm.id] && styles.appToggleDotOn]} />
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}

                <Text style={[styles.permTitle, styles.appsListTitle]}>Apps</Text>
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
                    <Ionicons name="add" size={14} color={Colors.primary} />
                  </View>
                  <Text style={styles.addAppText}>Add app to block</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {phase === 'done' && (
            <View style={styles.doneWrapper}>
              <PixelFlame size={64} state="static" style={styles.doneIcon} />
              <Text style={styles.doneTitle}>Session Complete!</Text>
              <Text style={styles.doneSub}>{duration} minutes of pure focus.</Text>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={externalTask ? () => void exitSession('afterDone') : handleStartAnother}
                activeOpacity={0.8}
              >
                <Text style={styles.startBtnText}>{externalTask ? 'Back to Today' : 'Start Another'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.ScrollView>
      )}

      {phase === 'active' && (
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
            <Animated.View style={[
              styles.blobWrap,
              { opacity: blobEnterAnim, transform: [{ scale: blobEnterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
            ]}>
              <Svg width={BLOB_WRAP} height={BLOB_WRAP} viewBox={`0 0 ${BLOB_SIZE} ${BLOB_SIZE}`}>
                <Path d={BLOB_PATH} fill={Colors.gray[100]} />
                <Path
                  d={TRACE_PATH}
                  fill="none"
                  stroke={Colors.gray[500]}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={TRACE_LENGTH}
                  strokeDashoffset={traceDashoffset}
                />
              </Svg>
              <View style={styles.blobContent}>
                <Text style={styles.blobTask} numberOfLines={1}>{externalTask?.title ?? 'Focus Session'}</Text>
                <Text style={styles.blobTime}>{formatMMSS(timeLeft)}</Text>
                <TouchableOpacity style={styles.pauseCircle} onPress={togglePause} activeOpacity={0.75}>
                  <Ionicons name={paused ? 'play' : 'pause'} size={20} color={Colors.gray[100]} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </View>
      )}

      {confirmOpen && (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeConfirm}>
          <LinearGradient
            colors={['rgba(6,6,8,0.2)', 'rgba(20,4,8,0.55)', 'rgba(30,4,10,0.92)']}
            locations={[0, 0.45, 1]}
            style={styles.confirmOverlay}
          >
            <TouchableOpacity style={styles.confirmClose} onPress={closeConfirm} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <Text style={styles.confirmTimer}>{formatMMSS(timeLeft)}</Text>

            {/* Plain View, not a Pressable — a tap anywhere on this card
                (other than the hold button, which owns its own press
                gesture and wins the touch responder) still bubbles up to
                the full-screen Pressable above and continues the timer. */}
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

              <Text style={styles.neverMind}>Tap anywhere to continue focusing</Text>
            </View>
          </LinearGradient>
        </Pressable>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hidden: { display: 'none' },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: 56, paddingBottom: Spacing.xxxl },

  title: { ...Typography.displayMedium, color: Colors.textPrimary },
  subtitle: { ...Typography.bodyMedium, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.xl },

  dialSection: { alignItems: 'center', marginBottom: Spacing.lg },

  startBtn: {
    backgroundColor: Colors.pop,
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
    fontFamily: Fonts.pixel, fontSize: 19, color: Colors.gray[400],
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  closeBtn: {
    width: 34, height: 34, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blobWrap: { width: BLOB_WRAP, height: BLOB_WRAP, alignItems: 'center', justifyContent: 'center' },
  blobContent: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 4 },
  blobTask: {
    fontSize: 12, fontFamily: Fonts.bold, color: Colors.gray[700],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  blobTime: { fontFamily: Fonts.pixel, fontSize: 52, color: Colors.ink, letterSpacing: 0, marginBottom: 10 },
  pauseCircle: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center',
  },

  // ── Hold-to-end confirm overlay ──────────────────────────────────────────
  confirmOverlay: { flex: 1, justifyContent: 'flex-end' },
  confirmClose: { position: 'absolute', top: 24, right: 22 },
  confirmTimer: {
    position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center',
    fontFamily: Fonts.pixel, fontSize: 58, color: 'rgba(255,255,255,0.5)',
  },
  confirmSheet: {
    backgroundColor: 'rgba(20,6,10,0.75)',
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1, borderTopColor: 'rgba(240,89,107,0.3)',
    paddingHorizontal: 26, paddingTop: 28, paddingBottom: 34 + TAB_BAR_CLEARANCE,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.5, borderColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  confirmTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 6 },
  confirmSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 22, fontFamily: Fonts.regular },
  holdBtn: {
    width: '100%', paddingVertical: 15, borderRadius: BorderRadius.full,
    borderWidth: 1.5, alignItems: 'center',
  },
  holdLabel: { fontFamily: Fonts.retro, fontSize: 16, letterSpacing: 0.5, color: Colors.textPrimary },
  neverMind: { fontSize: 13, color: Colors.textSecondary, marginTop: 14, fontFamily: Fonts.regular },

  // ── Done phase ────────────────────────────────────────────────────────────
  doneWrapper: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  doneIcon: { marginBottom: Spacing.sm },
  doneTitle: { ...Typography.headlineLarge, color: Colors.textPrimary },
  doneSub: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: Spacing.lg },

  // ── Blocked apps (setup phase, not a mid-session sheet anymore) ──────────
  appsSection: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6,
    marginTop: Spacing.xl,
  },
  appsTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 4 },
  appsSub: { fontSize: 12.5, color: Colors.textSecondary, marginBottom: 18, fontFamily: Fonts.regular },
  permTitle: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  appsListTitle: { marginTop: 16 },
  permSub: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10, fontFamily: Fonts.regular },
  permRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  permTextWrap: { flex: 1 },
  permDescription: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2, fontFamily: Fonts.regular },
  permGrantText: { color: Colors.primary, fontSize: 13.5, fontFamily: Fonts.semibold, marginRight: 2 },
  appRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  appName: { flex: 1, fontSize: 14.5, color: Colors.textPrimary, fontFamily: Fonts.regular },
  appToggle: { width: 40, height: 24, borderRadius: 12, backgroundColor: Colors.border, justifyContent: 'center' },
  appToggleOn: { backgroundColor: Colors.pop },
  appToggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.textPrimary, marginLeft: 3 },
  appToggleDotOn: { marginLeft: 19, backgroundColor: Colors.background },
  addAppRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  addAppIcon: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addAppText: { color: Colors.primary, fontSize: 14.5, fontFamily: Fonts.medium },
});
