import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { BlobDial } from '../components/BlobDial';
import { MeditatingFlame } from '../components/MeditatingFlame';
import { BLOCKABLE_APPS, DEFAULT_BLOCKED_APPS, BLOCKED_APPS_STORAGE_KEY } from '../data/blockableApps';
import { openPermissionSettings } from '../utils/appBlocking';
import { useHaptics } from '../hooks/useHaptics';

const MIN_MINS = 15;
const MAX_MINS = 180;
const STEP_MINS = 5;
const DEFAULT_MINS = 60;
const LOCK_IN_MS = 2000;

function formatGoal(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface Props {
  initialMins?: number;
  onComplete: (dailyFocusGoalMins: number) => void;
  onBack?: () => void;
}

// Screen 3 of onboarding (also reused from the Profile screen to change the
// goal later) — the same squiggly-blob shape as the Focus timer, grey,
// dragged to set the daily goal, plus a preview of which apps will be
// blocked during a focus session (the full toggle picker lives on the
// Focus screen itself — this is just a glance + a way to grant the OS
// permission early).
export const FocusGoalScreen: React.FC<Props> = ({ initialMins = DEFAULT_MINS, onComplete, onBack }) => {
  const [mins, setMins] = useState(initialMins);
  const [blockedApps, setBlockedApps] = useState<string[]>(DEFAULT_BLOCKED_APPS);
  const [locking, setLocking] = useState(false);
  const { buttonPress } = useHaptics();

  const dialScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(BLOCKED_APPS_STORAGE_KEY);
        if (raw) setBlockedApps(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  const handleBlockApps = async () => {
    await buttonPress();
    try {
      await openPermissionSettings('usageAccess');
    } catch {
      Alert.alert('Not available', 'App blocking can only be set up on an Android build outside Expo Go.');
    }
  };

  const handleLockIn = () => {
    if (locking) return;
    setLocking(true);
    buttonPress();
    // Glows + zooms in, holds, then snaps back with a spring overshoot —
    // reads as the goal getting "etched" into place rather than a plain fade.
    Animated.sequence([
      Animated.parallel([
        Animated.timing(dialScale, { toValue: 1.14, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.parallel([
        Animated.spring(dialScale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start(() => {
      buttonPress();
      onComplete(mins);
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}

      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.titleRegular}>What's your</Text>
          <Text style={styles.titlePixel}>Focus Goal?</Text>
        </View>
        <MeditatingFlame size={78} />
      </View>

      <View style={styles.dialWrap}>
        <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: dialScale }] }]} />
        <Animated.View style={{ transform: [{ scale: dialScale }] }}>
          <BlobDial
            size={250}
            minValue={MIN_MINS}
            maxValue={MAX_MINS}
            step={STEP_MINS}
            value={mins}
            onChange={setMins}
            formatValue={formatGoal}
            unitLabel="per day"
          />
        </Animated.View>
      </View>

      <View style={styles.blockSection}>
        <TouchableOpacity style={styles.blockAppsBtn} onPress={handleBlockApps} activeOpacity={0.8}>
          <Ionicons name="shield-outline" size={16} color={Colors.textPrimary} />
          <Text style={styles.blockAppsText}>Block Apps</Text>
        </TouchableOpacity>
        <View style={styles.appIconsRow}>
          {blockedApps.map(id => {
            const app = BLOCKABLE_APPS.find(a => a.id === id);
            if (!app) return null;
            return (
              <View key={id} style={[styles.appChip, { backgroundColor: app.color }]}>
                <Ionicons name={app.icon} size={18} color="#fff" />
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.lockBtn} onPress={handleLockIn} activeOpacity={0.85} disabled={locking}>
          <View style={styles.lockGradient}>
            <Text style={styles.lockText}>Lock This In</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backBtn: { position: 'absolute', top: 58, left: Spacing.xl, zIndex: 2 },
  backText: { fontSize: 15, color: Colors.textSecondary, fontFamily: Fonts.medium },
  header: {
    paddingTop: 90, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  titleBlock: { flex: 1, paddingRight: Spacing.md },
  titleRegular: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: -0.3 },
  titlePixel: { fontFamily: Fonts.pixel, fontSize: 40, color: Colors.pop, letterSpacing: 0.5, marginTop: -4 },
  dialWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', width: 250 * 1.25, height: 250 * 1.25, borderRadius: 250,
    backgroundColor: Colors.pop, shadowColor: Colors.pop, shadowOpacity: 0.9, shadowRadius: 40, elevation: 20,
  },
  blockSection: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, gap: Spacing.sm },
  blockAppsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.full,
    borderWidth: 2, borderColor: Colors.border, paddingVertical: 14,
  },
  blockAppsText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textPrimary },
  appIconsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  appChip: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, paddingTop: Spacing.sm },
  lockBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  lockGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.pop },
  lockText: { fontSize: 17, fontFamily: Fonts.bold, color: '#000', letterSpacing: 0.2 },
});
