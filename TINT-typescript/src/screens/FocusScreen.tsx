import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AppState,
  AppStateStatus,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FocusLog, UserProfile } from '../types';
import { storage } from '../utils/storage';
import { syncToCloud } from '../utils/supabase';
import { getAppDate, calcFocusMetrics, formatMinutes } from '../utils/logic';

const PRESETS = [25, 45, 60, 90];

type TimerState = 'idle' | 'running' | 'paused' | 'done';

interface Props {
  profile: UserProfile;
}

export default function FocusScreen({ profile }: Props) {
  const [duration, setDuration] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [focusLog, setFocusLog] = useState<FocusLog[]>([]);
  const [leftDuringFocus, setLeftDuringFocus] = useState(false);
  const [sessionMins, setSessionMins] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const loadLog = useCallback(async () => {
    const f = await storage.getFocusLog();
    setFocusLog(f);
  }, []);

  useEffect(() => { loadLog(); }, [loadLog]);

  useEffect(() => {
    if (timerState === 'running') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [timerState, pulseAnim]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current === 'active' && next === 'background' && timerState === 'running') {
        setLeftDuringFocus(true);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [timerState]);

  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerState]);

  async function handleComplete() {
    setTimerState('done');
    await saveSession(duration);
    setSessionMins(duration);
  }

  async function saveSession(mins: number) {
    const today = getAppDate();
    const log = await storage.getFocusLog();
    const existing = log.find(e => e.date === today);
    let updated: FocusLog[];
    if (existing) {
      updated = log.map(e => e.date === today ? { ...e, mins: e.mins + mins } : e);
    } else {
      updated = [...log, { date: today, mins }];
    }
    await storage.setFocusLog(updated);
    setFocusLog(updated);
    const [tasks, history] = await Promise.all([storage.getTasks(), storage.getHistory()]);
    syncToCloud(profile.email, profile, tasks, history, updated).catch(() => {});
  }

  function start() {
    setLeftDuringFocus(false);
    setTimerState('running');
  }

  function pause() { setTimerState('paused'); }

  function resume() {
    setLeftDuringFocus(false);
    setTimerState('running');
  }

  function reset() {
    setTimerState('idle');
    setRemaining(duration * 60);
    setLeftDuringFocus(false);
    setSessionMins(0);
  }

  function selectDuration(mins: number) {
    if (timerState !== 'idle') return;
    setDuration(mins);
    setRemaining(mins * 60);
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = 1 - remaining / (duration * 60);
  const { focusToday, focusTotal } = calcFocusMetrics(focusLog);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.pageTitle}>Focus</Text>

        {leftDuringFocus && timerState !== 'done' && (
          <View style={s.warnBanner}>
            <Text style={s.warnText}>⚠️ You left the app during your focus session!</Text>
          </View>
        )}

        {timerState === 'idle' && (
          <View style={s.presets}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p}
                style={[s.preset, duration === p && s.presetActive]}
                onPress={() => selectDuration(p)}
              >
                <Text style={[s.presetText, duration === p && s.presetTextActive]}>{p}m</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Animated.View style={[s.ringWrap, { transform: [{ scale: pulseAnim }] }]}>
          <View style={s.ring}>
            <View style={[s.ringTrack, { borderColor: 'rgba(255,255,255,0.06)' }]} />
            <View
              style={[
                s.ringProgress,
                {
                  borderColor: timerState === 'done' ? '#22C55E' : '#6366F1',
                  transform: [{ rotate: `${progress * 360 - 90}deg` }],
                  opacity: progress > 0 ? 1 : 0,
                },
              ]}
            />
            <View style={s.ringInner}>
              {timerState === 'done' ? (
                <>
                  <Text style={s.doneEmoji}>🎉</Text>
                  <Text style={s.doneText}>Done!</Text>
                  <Text style={s.doneSub}>{formatMinutes(sessionMins)} focused</Text>
                </>
              ) : (
                <>
                  <Text style={s.timerText}>
                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                  </Text>
                  <Text style={s.timerLabel}>
                    {timerState === 'idle' ? `${duration} min session` :
                     timerState === 'paused' ? 'paused' : 'focusing'}
                  </Text>
                </>
              )}
            </View>
          </View>
        </Animated.View>

        <View style={s.controls}>
          {timerState === 'idle' && (
            <TouchableOpacity style={s.btnPrimary} onPress={start}>
              <Text style={s.btnPrimaryText}>Start Focus</Text>
            </TouchableOpacity>
          )}
          {timerState === 'running' && (
            <>
              <TouchableOpacity style={s.btnSecondary} onPress={pause}>
                <Text style={s.btnSecondaryText}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnGhost} onPress={reset}>
                <Text style={s.btnGhostText}>Stop</Text>
              </TouchableOpacity>
            </>
          )}
          {timerState === 'paused' && (
            <>
              <TouchableOpacity style={s.btnPrimary} onPress={resume}>
                <Text style={s.btnPrimaryText}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnGhost} onPress={reset}>
                <Text style={s.btnGhostText}>Reset</Text>
              </TouchableOpacity>
            </>
          )}
          {timerState === 'done' && (
            <TouchableOpacity style={s.btnPrimary} onPress={reset}>
              <Text style={s.btnPrimaryText}>New Session</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Block apps — disabled until final build */}
        <View style={s.blockBtn}>
          <Text style={s.blockIcon}>🔒</Text>
          <View style={s.blockInfo}>
            <Text style={s.blockTitle}>Block distracting apps</Text>
            <Text style={s.blockSub}>Available in the final app build</Text>
          </View>
          <View style={s.comingSoonBadge}>
            <Text style={s.comingSoonText}>Soon</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{formatMinutes(focusToday)}</Text>
            <Text style={s.statLabel}>Today</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{formatMinutes(focusTotal)}</Text>
            <Text style={s.statLabel}>All time</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const RING_SIZE = 260;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080810' },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40, alignItems: 'center' },
  pageTitle: { color: '#fff', fontSize: 24, fontWeight: '800', alignSelf: 'flex-start', marginBottom: 20 },

  warnBanner: { width: '100%', backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)' },
  warnText: { color: '#F87171', fontSize: 13, textAlign: 'center' },

  presets: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  preset: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'transparent' },
  presetActive: { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: '#6366F1' },
  presetText: { color: 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: '600' },
  presetTextActive: { color: '#6366F1' },

  ringWrap: { marginBottom: 40 },
  ring: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringTrack: { position: 'absolute', width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderWidth: 10 },
  ringProgress: { position: 'absolute', width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderWidth: 10, borderLeftColor: 'transparent', borderBottomColor: 'transparent' },
  ringInner: { alignItems: 'center' },
  timerText: { color: '#fff', fontSize: 56, fontWeight: '800', letterSpacing: -2 },
  timerLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 4 },
  doneEmoji: { fontSize: 48, marginBottom: 4 },
  doneText: { color: '#22C55E', fontSize: 32, fontWeight: '800' },
  doneSub: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 },

  controls: { flexDirection: 'row', gap: 12, marginBottom: 32, width: '100%' },
  btnPrimary: { flex: 1, backgroundColor: '#6366F1', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: { flex: 1, backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#6366F1' },
  btnSecondaryText: { color: '#6366F1', fontSize: 16, fontWeight: '700' },
  btnGhost: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnGhostText: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '600' },

  blockBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 24, opacity: 0.5 },
  blockIcon: { fontSize: 24, marginRight: 12 },
  blockInfo: { flex: 1 },
  blockTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  blockSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  comingSoonBadge: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  comingSoonText: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 12, width: '100%' },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 4 },
});
