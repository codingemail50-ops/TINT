import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  AppState as RNAppState, ActivityIndicator, BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { PixelIcon } from '../components/PixelIcon';
import {
  DayFlame, DayProgressBar, Eyebrow, HoldToConfirm, LightButton, LogoFlame, PrimaryButton, SecondaryButton, useNow, challengeStyles as cs,
} from '../components/ChallengeParts';
import { BLOCKABLE_APPS, packageNamesFor } from '../data/blockableApps';
import { quoteFor, progressLine, WIN_VARIANTS } from '../data/challengeMessages';
import { checkPermission, isNativeBlockingAvailable, stopAppBlocking } from '../utils/appBlocking';
import {
  LocalChallenge, MemberRow, UsageSnapshot, EMERGENCY_LIMIT, EMERGENCY_MS,
  loadLocalChallenge, fetchMyLatestChallenge, refreshChallenge, fetchMembers, syncServerClock,
  touchChallenge, onChallengeRunning, armChallengeBlocking, uploadChallengeStats, triggerEmergency, quitChallenge,
  serverNow, hasStarted, dayNumber, daysCompleted, progressFraction, formatTimeLeft,
  urgesToday, urgesTotal, urgesByApp, fetchMyBaseline, saveReport, clearLocalChallenge,
  cancelChallengeNotifications, challengeErrorMessage, getWinVariant,
} from '../utils/challenge';
import { useHaptics } from '../hooks/useHaptics';
import { confirmDeleteAccount, openPrivacyPolicy } from '../utils/accountDeletion';
import { ConfirmDialog, DialogConfig } from '../components/ConfirmDialog';
import { notificationsAllowed, askForNotifications } from '../utils/notificationAccess';

interface Props {
  /** No challenge on this account, or they chose to go again. */
  onRestart: () => void;
  /** Finished (or left) and wants regular TINT for studying. */
  onUpgrade: () => void;
  onAccountDeleted: () => void;
  /** Set when someone with a regular TINT account opened this from the Focus
   *  tab. They get "Back to TINT" instead of "Use TINT for studying" (they
   *  already do), and the phone's Back button returns to TINT too. */
  onExit?: () => void;
}

const MEMBER_POLL_MS = 15_000;
// Was 10 seconds for each of the two waits below (up to 20 on a spinner when
// the phone has no saved copy of the challenge). With a saved copy nothing
// waits at all: it shows at once and these only refresh it.
const CLOCK_TIMEOUT_MS = 2_000;
const NETWORK_TIMEOUT_MS = 4_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}

function appLabel(pkg: string): string {
  return BLOCKABLE_APPS.find(a => a.packageName === pkg)?.label ?? pkg;
}

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The running 7 Day Lock In: day X of 7, the progress bar, time left,
// urges resisted, a quote for where they are in the week, the squad, the
// emergency unlock, and leaving. Also the finished and left screens.
// Privacy policy and Delete account: quiet, grey and at the very bottom of the
// screen (the spacer pushes them down on a tall phone), so nobody taps them by
// accident. Delete account is still here, because the app must offer it.
const FooterLinks: React.FC<{ onDelete: () => void }> = ({ onDelete }) => (
  <>
    <View style={styles.footerSpacer} />
    <View style={styles.footerLinks}>
      <TouchableOpacity onPress={openPrivacyPolicy} hitSlop={8}>
        <Text style={styles.footerLink}>Privacy policy</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} hitSlop={8}>
        <Text style={styles.footerLink}>Delete account</Text>
      </TouchableOpacity>
    </View>
  </>
);

export const ChallengeHomeScreen: React.FC<Props> = ({ onRestart, onUpgrade, onAccountDeleted, onExit }) => {
  useEffect(() => {
    if (!onExit) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onExit(); return true; });
    return () => sub.remove();
  }, [onExit]);
  const [local, setLocal] = useState<LocalChallenge | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [baseline, setBaseline] = useState<UsageSnapshot | null>(null);
  const [blockingOk, setBlockingOk] = useState(true);
  // Notifications can be switched off after the challenge starts (in Android
  // settings, or by swiping a channel off). Blocking keeps running, but the
  // person can no longer see the "live" notification, so say so.
  const [notifOff, setNotifOff] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  // While there is no saved copy and the server is slow, say what is happening.
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    if (local) { setSlowLoad(false); return; }
    const t = setTimeout(() => setSlowLoad(true), 1500);
    return () => clearTimeout(t);
  }, [local]);
  // The confirmation boxes on this screen (emergency unlock, leaving), shown in
  // TINT's own style instead of Android's system alert.
  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const [sharing, setSharing] = useState(false);
  const [winVariant, setWinVariant] = useState<number | null>(null);
  const tick = useNow(1000);
  const { buttonPress } = useHaptics();
  const cardRef = useRef<View>(null);
  const reportSavedRef = useRef(false);
  const onRestartRef = useRef(onRestart);
  onRestartRef.current = onRestart;

  const refresh = useCallback(async () => {
    let current = await loadLocalChallenge();
    // Show the phone's copy straight away (and keep blocking armed) instead
    // of waiting on the network, which can take a while on a bad
    // connection.
    if (current && current.status !== 'lobby') {
      if (current.status === 'active') armChallengeBlocking(current);
      setLocal(current);
    }
    await withTimeout(syncServerClock(), CLOCK_TIMEOUT_MS, undefined);
    try {
      const fetched = current ? refreshChallenge(current) : fetchMyLatestChallenge();
      current = await withTimeout(fetched, NETWORK_TIMEOUT_MS, current);
    } catch {
      // Offline: carry on with the local copy, blocking keeps working.
    }
    if (!current || current.status === 'lobby') {
      onRestartRef.current();
      return;
    }
    if (current.status === 'active') {
      current = await onChallengeRunning(current);
      void touchChallenge(current.id);
    } else {
      // Finished or left: make sure nothing is still blocking.
      stopAppBlocking();
      void cancelChallengeNotifications();
    }
    void uploadChallengeStats(current);
    setLocal(current);
    if (isNativeBlockingAvailable()) {
      setBlockingOk(checkPermission('usageAccess') === true && checkPermission('overlay') === true);
    }
    if (current.mode === 'squad') {
      try {
        setMembers(await fetchMembers(current.id));
      } catch {}
    }
    if (current.status === 'done') setBaseline(await fetchMyBaseline(current));
  }, []);

  useEffect(() => {
    void refresh();
    const sub = RNAppState.addEventListener('change', s => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Checked on its own (not inside refresh) so a slow connection never delays
  // the notifications warning. Re-checked each time the app comes back to the
  // front, e.g. after the person visits Android settings.
  useEffect(() => {
    if (!isNativeBlockingAvailable()) return;
    const check = () => { void notificationsAllowed().then(ok => setNotifOff(!ok)); };
    check();
    const sub = RNAppState.addEventListener('change', s => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, []);

  // Squad list stays fresh while the screen is open.
  useEffect(() => {
    if (!local || local.mode !== 'squad') return;
    const id = setInterval(() => {
      fetchMembers(local.id).then(setMembers).catch(() => {});
    }, MEMBER_POLL_MS);
    return () => clearInterval(id);
  }, [local?.id, local?.mode]);

  // The moment the 7 days run out while the screen is open (once, not on
  // every tick while the refresh is still in flight).
  const finishRefreshRef = useRef<string | null>(null);
  useEffect(() => {
    if (local?.status === 'active' && local.endAtMs !== null && serverNow() >= local.endAtMs
      && finishRefreshRef.current !== local.id) {
      finishRefreshRef.current = local.id;
      void refresh();
    }
  }, [tick, local, refresh]);

  // Completion wording: assigned once per person, then always the same.
  useEffect(() => {
    if (local?.status !== 'done' || winVariant !== null) return;
    void getWinVariant(WIN_VARIANTS.length).then(setWinVariant);
  }, [local?.status, winVariant]);

  // Save the final report once.
  useEffect(() => {
    if (!local || local.status !== 'done' || reportSavedRef.current) return;
    reportSavedRef.current = true;
    void saveReport(local, {
      urgesResisted: urgesTotal(local),
      urgesByApp: urgesByApp(local),
      emergencyUsed: local.emergencyUsed,
      before: baseline,
      completedAtMs: local.endAtMs ?? serverNow(),
    });
  }, [local, baseline]);

  if (!local) {
    return (
      <View style={[cs.screen, styles.center]}>
        <StatusBar style="light" />
        <ActivityIndicator color={Colors.pop} />
        {slowLoad && <Text style={[cs.sub, { marginTop: 16, textAlign: 'center' }]}>Loading your 7 Day Lock In...</Text>}
      </View>
    );
  }

  const now = serverNow();
  const day = dayNumber(local, now);
  const started = hasStarted(local, now);
  const today = urgesToday(local);
  const total = urgesTotal(local);
  const emergencyLeftMs = local.emergencyUntilMs - now;
  const emergencyActive = emergencyLeftMs > 0;
  const emergencyLeft = Math.max(0, EMERGENCY_LIMIT - local.emergencyUsed);

  const pressEmergency = () => {
    void buttonPress();
    if (emergencyLeft === 0) {
      setDialog({
        title: 'No unlocks left',
        message: `You've used both emergency unlocks for this challenge.`,
        confirmLabel: 'OK',
      });
      return;
    }
    setDialog({
      title: 'Emergency unlock?',
      message: `All your apps unlock for ${EMERGENCY_MS / 60_000} minutes, then lock again by themselves. You have ${emergencyLeft} left for the whole challenge.`,
      confirmLabel: 'Unlock for 5 min',
      cancelLabel: 'Cancel',
      onConfirm: async () => setLocal(await triggerEmergency(local)),
    });
  };

  const pressLeave = () => {
    void buttonPress();
    const streak = daysCompleted(local, now);
    setDialog({
      title: 'You sure?',
      message: `You're on day ${day} of 7. ${streak > 0 ? `That's ${streak} full day${streak === 1 ? '' : 's'} you already won.` : 'The first day is the hardest. You can get through it.'}`,
      confirmLabel: 'I still want to leave',
      cancelLabel: 'Stay locked in',
      destructive: true,
      onConfirm: () => setDialog({
        title: 'This ends your challenge',
        message: local.mode === 'squad'
          ? 'Your streak and badge are gone, and your squad will see that you left.'
          : 'Your streak and badge are gone, and you would start again from day 1.',
        confirmLabel: 'Continue',
        cancelLabel: 'Stay locked in',
        destructive: true,
        onConfirm: () => setLeaveOpen(true),
      }),
    });
  };

  // Closes the box, then runs its action. An action that opens the next box
  // simply replaces it, so there is no flash in between.
  const dialogConfirm = () => {
    const d = dialog;
    setDialog(null);
    d?.onConfirm?.();
  };

  const confirmLeave = async () => {
    try {
      setLocal(await quitChallenge(local));
    } catch (err) {
      setDialog({ title: "Couldn't leave", message: challengeErrorMessage(err), confirmLabel: 'OK' });
    } finally {
      setLeaveOpen(false);
    }
  };

  const goAgain = async () => {
    void buttonPress();
    await clearLocalChallenge();
    onRestart();
  };

  const share = async () => {
    void buttonPress();
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your 7 Day Lock In' });
      }
    } catch {
      // Nice-to-have only.
    } finally {
      setSharing(false);
    }
  };

  // ── finished ──────────────────────────────────────────────────────────
  if (local.status === 'done') {
    const byApp = Object.entries(urgesByApp(local)).sort((a, b) => b[1] - a[1]);
    const beforeApps = baseline ? Object.entries(baseline.apps) : [];
    const beforeOpens = beforeApps.reduce((a, [, v]) => a + v.opens, 0);
    const beforeTime = beforeApps.reduce((a, [, v]) => a + v.foregroundMs, 0);
    if (winVariant === null) {
      return (
        <View style={[cs.screen, styles.center]}>
          <StatusBar style="light" />
          <ActivityIndicator color={Colors.pop} />
        </View>
      );
    }
    const wording = WIN_VARIANTS[winVariant];
    return (
      <View style={cs.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={[cs.content, styles.contentGrow]}>
          <View ref={cardRef} collapsable={false} style={[cs.card, styles.reportCard]}>
            <LogoFlame size={96} />
            <Eyebrow>7 Day Lock In · Complete</Eyebrow>
            <Text style={styles.reportTitle}>{wording.headline}</Text>
            <Text style={styles.reportLine}>{wording.line}</Text>
            <View style={styles.bigStatRow}>
              <BigStat value={`${local.days}/${local.days}`} label="days completed" />
              <BigStat value={String(total)} label="blocked attempts" />
            </View>
            {byApp.slice(0, 3).map(([pkg, n]) => (
              <Text key={pkg} style={styles.reportLine}>You tried to open {appLabel(pkg)} {n} time{n === 1 ? '' : 's'}.</Text>
            ))}
            {baseline && beforeOpens > 0 && (
              <Text style={styles.reportLine}>
                The week before, you opened these apps {beforeOpens} times and spent {formatDuration(beforeTime)} on them.
              </Text>
            )}
          </View>
          <PrimaryButton label="SHARE YOUR WIN" onPress={() => void share()} loading={sharing} />
          <Text style={[cs.sub, styles.momentum]}>Turn this momentum into something more.</Text>
          {onExit
            ? <LightButton label="BACK TO TINT" onPress={onExit} />
            : <SecondaryButton label="KEEP THE MOMENTUM" onPress={onUpgrade} />}
          <TouchableOpacity onPress={() => void goAgain()} hitSlop={8}>
            <Text style={cs.link}>Do another 7 days</Text>
          </TouchableOpacity>
          <FooterLinks onDelete={() => confirmDeleteAccount(onAccountDeleted)} />
        </ScrollView>
      </View>
    );
  }

  // ── left early ────────────────────────────────────────────────────────
  if (local.status === 'quit') {
    return (
      <View style={cs.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={[cs.content, styles.contentGrow]}>
          <Eyebrow>Challenge ended</Eyebrow>
          <Text style={cs.title}>You made it to day {local.quitDay ?? day}.</Text>
          <Text style={cs.sub}>Every hour you held counts. You resisted {total} urge{total === 1 ? '' : 's'}. Try again when you're ready.</Text>
          <PrimaryButton label="Start again" onPress={() => void goAgain()} />
          {onExit
            ? <LightButton label="Back to TINT" onPress={onExit} />
            : <SecondaryButton label="Use TINT for studying" onPress={onUpgrade} />}
          <FooterLinks onDelete={() => confirmDeleteAccount(onAccountDeleted)} />
        </ScrollView>
      </View>
    );
  }

  // ── running ───────────────────────────────────────────────────────────
  const blockedPkgs = packageNamesFor(local.apps);
  return (
    <View style={cs.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[cs.content, styles.contentGrow]}>
        <Eyebrow>7 Day Lock In</Eyebrow>
        <View style={styles.titleRow}>
          {started ? (
            <Text style={[styles.dayTitle, styles.titleText]}>Day {day} <Text style={styles.dayOf}>of {local.days}</Text></Text>
          ) : (
            <Text style={[styles.dayTitle, styles.titleText]}>Starts in {formatTimeLeft((local.startAtMs ?? now) - now)}</Text>
          )}
          <DayFlame day={Math.max(1, day)} maxSize={52} />
        </View>

        <View style={styles.progressBlock}>
          <DayProgressBar days={local.days} fraction={progressFraction(local, now)} />
          {started && <Text style={cs.sub}>{progressLine(day)}</Text>}
        </View>

        {!blockingOk && (
          <View style={[cs.card, styles.warning]}>
            <Text style={styles.warningText}>Blocking is off: TINT is missing a permission. Open TINT's settings in Android and allow Usage access and Display over other apps.</Text>
          </View>
        )}

        {notifOff && (
          <View style={[cs.card, styles.warning]}>
            <Text style={styles.warningText}>Notifications are off, so Android may hide the "7 Day Lock In Active" notification. Blocking still works, but you can't see it's live.</Text>
            <TouchableOpacity
              onPress={() => { void askForNotifications().then(() => notificationsAllowed()).then(ok => setNotifOff(!ok)); }}
              hitSlop={8}
            >
              <Text style={styles.warningLink}>Turn on notifications</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statRow}>
          <SmallStat value={local.endAtMs ? formatTimeLeft(local.endAtMs - now, true) : '-'} label="left" />
          <SmallStat value={String(daysCompleted(local, now))} label="day streak" />
          <SmallStat value={String(today)} label="urges today" />
        </View>

        {started && (
          <View style={[cs.card, styles.quoteCard]}>
            <Text style={styles.quote}>{quoteFor(day, today, Date.now())}</Text>
          </View>
        )}

        {local.mode === 'squad' && (
          <View style={cs.card}>
            <Text style={cs.label}>SQUAD · {members.filter(m => m.status === 'active').length} STILL IN</Text>
            {members.map(m => {
              const out = m.status === 'quit';
              return (
                <View key={m.user_id} style={styles.memberRow}>
                  <View style={[styles.memberAvatar, out && styles.memberOut]}><PixelIcon name={m.avatar} size={26} /></View>
                  <Text style={[styles.memberName, out && styles.memberNameOut]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[styles.memberTag, out && styles.memberTagOut]}>{out ? 'OUT' : 'IN'}</Text>
                </View>
              );
            })}
          </View>
        )}

        <Text style={cs.sub}>Blocked: {blockedPkgs.map(appLabel).join(', ') || 'nothing'}</Text>

        {emergencyActive ? (
          <View style={[cs.card, styles.emergencyOn]}>
            <Text style={styles.emergencyOnText}>Apps unlocked · locks again in {formatClock(emergencyLeftMs)}</Text>
          </View>
        ) : (
          <SecondaryButton
            label={`Emergency unlock · ${emergencyLeft} left`}
            onPress={pressEmergency}
            disabled={emergencyLeft === 0 || !started}
          />
        )}

        {onExit && (
          <LightButton label="Back to TINT" onPress={onExit} />
        )}
        <TouchableOpacity onPress={pressLeave} hitSlop={8}>
          <Text style={[cs.link, styles.leaveLink]}>Leave challenge</Text>
        </TouchableOpacity>
        <FooterLinks onDelete={() => confirmDeleteAccount(onAccountDeleted)} />
      </ScrollView>

      <Modal visible={leaveOpen} transparent animationType="fade" onRequestClose={() => setLeaveOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[cs.card, styles.leaveCard]}>
            <Text style={styles.leaveTitle}>Hold to leave</Text>
            <Text style={cs.sub}>Hold the button for 3 seconds. Let go to stay.</Text>
            <HoldToConfirm label="Hold to leave the challenge" onConfirm={() => void confirmLeave()} />
            <TouchableOpacity onPress={() => setLeaveOpen(false)} hitSlop={8}>
              <Text style={[cs.link, styles.stay]}>Stay locked in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmDialog dialog={dialog} onConfirm={dialogConfirm} onCancel={() => setDialog(null)} />
    </View>
  );
};

const SmallStat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <View style={[cs.card, styles.smallStat]}>
    <Text style={styles.smallStatValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={cs.label}>{label.toUpperCase()}</Text>
  </View>
);

const BigStat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <View style={styles.bigStat}>
    <Text style={styles.bigStatValue}>{value}</Text>
    <Text style={cs.label}>{label.toUpperCase()}</Text>
  </View>
);

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  dayTitle: { fontFamily: Fonts.pixel, fontSize: 56, color: Colors.textPrimary, letterSpacing: 0.5, marginTop: -Spacing.sm },
  dayOf: { fontSize: 32, color: Colors.textMuted },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  titleText: { flexShrink: 1 },
  momentum: { textAlign: 'center', marginBottom: -Spacing.sm },
  progressBlock: { gap: Spacing.sm },
  statRow: { flexDirection: 'row', gap: 8 },
  smallStat: { flex: 1, padding: Spacing.md, gap: 4, alignItems: 'flex-start' },
  smallStatValue: { fontFamily: Fonts.pixel, fontSize: 26, color: Colors.textPrimary },
  quoteCard: { borderColor: Colors.pop + '55' },
  quote: { fontSize: 18, lineHeight: 26, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  warning: { borderColor: Colors.danger },
  warningText: { fontSize: 13, lineHeight: 19, fontFamily: Fonts.medium, color: Colors.danger },
  warningLink: { fontSize: 14, fontFamily: Fonts.semibold, color: Colors.pop, marginTop: Spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  contentGrow: { flexGrow: 1 },
  footerSpacer: { flex: 1, minHeight: Spacing.xxl },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl, paddingTop: Spacing.md },
  footerLink: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted },
  leaveLink: { color: Colors.danger, fontFamily: Fonts.semibold },
  danger: { color: Colors.danger },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  memberOut: { opacity: 0.35 },
  memberName: { flex: 1, fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  memberNameOut: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  memberTag: { fontFamily: Fonts.pixel, fontSize: 18, color: Colors.pop },
  memberTagOut: { color: Colors.textMuted },
  emergencyOn: { borderColor: Colors.pop, alignItems: 'center' },
  emergencyOnText: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.pop },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: Spacing.xl },
  leaveCard: { gap: Spacing.md },
  leaveTitle: { fontFamily: Fonts.pixel, fontSize: 30, color: Colors.textPrimary },
  stay: { color: Colors.pop, fontFamily: Fonts.semibold, fontSize: 15 },
  reportCard: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  reportTitle: { fontFamily: Fonts.pixel, fontSize: 40, color: Colors.textPrimary, textAlign: 'center' },
  bigStatRow: { flexDirection: 'row', gap: Spacing.xl },
  bigStat: { alignItems: 'center', gap: 2 },
  bigStatValue: { fontFamily: Fonts.pixel, fontSize: 48, color: Colors.pop },
  reportLine: { fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },
});
