import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Share, Alert,
  AppState as RNAppState, ActivityIndicator, Platform, BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as IntentLauncher from 'expo-intent-launcher';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { PixelIcon } from '../components/PixelIcon';
import {
  AppPicker, Eyebrow, PrimaryButton, SecondaryButton, challengeStyles as cs,
} from '../components/ChallengeParts';
import { checkPermission, openPermissionSettings, isNativeBlockingAvailable, BlockingPermission } from '../utils/appBlocking';
import {
  LocalChallenge, MemberRow, MAX_SQUAD, DEFAULT_CHALLENGE_APPS,
  createChallenge, joinChallenge, startSquad, leaveLobby, fetchMembers, refreshChallenge,
  fetchMyLatestChallenge, loadLocalChallenge, challengeErrorMessage, onChallengeRunning,
} from '../utils/challenge';
import { useHaptics } from '../hooks/useHaptics';
import { confirmDeleteAccount, openPrivacyPolicy } from '../utils/accountDeletion';
import { hasLockInConsent, setLockInConsent } from '../utils/permissionConsent';
import { notificationsAllowed, askForNotifications } from '../utils/notificationAccess';

type Step = 'loading' | 'disclosure' | 'permissions' | 'choose' | 'solo' | 'squad' | 'create' | 'join' | 'lobby';
type StartChoice = 'now' | 'tonight' | 'tomorrow';

interface Props {
  onStarted: (local: LocalChallenge) => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
}

const LOBBY_POLL_MS = 3000;
// How long the first screen waits to learn whether this account is already in
// a challenge (see the load effect). Was 10 seconds.
const SERVER_LOOKUP_MS = 3000;

function startTimeFor(choice: StartChoice): number | null {
  if (choice === 'now') return null;
  const d = new Date();
  if (choice === 'tonight') {
    d.setHours(21, 0, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(7, 0, 0, 0);
  }
  return d.getTime();
}

function permissionsReady(): boolean {
  if (!isNativeBlockingAvailable()) return true;
  return checkPermission('usageAccess') === true && checkPermission('overlay') === true;
}

// Everything between the intro slides and the running challenge: the two
// permissions blocking needs, solo vs squad, picking apps, and the squad
// lobby (code, live member list, Start).
export const ChallengeSetupScreen: React.FC<Props> = ({ onStarted, onLogout, onAccountDeleted }) => {
  const [step, setStep] = useState<Step>('loading');
  const [apps, setApps] = useState<string[]>(DEFAULT_CHALLENGE_APPS);
  const [startChoice, setStartChoice] = useState<StartChoice>('now');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [lobby, setLobby] = useState<LocalChallenge | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [grants, setGrants] = useState({ usageAccess: false, overlay: false });
  const [notifGranted, setNotifGranted] = useState(false);
  const { buttonPress } = useHaptics();
  const startedRef = useRef(false);
  // Kept in a ref so `begin` (and the effects that use it) keep one stable
  // identity while the parent re-renders.
  const onStartedRef = useRef(onStarted);
  onStartedRef.current = onStarted;

  // Notifications are required too (native builds only), so this has to ask
  // Android, which makes it async.
  const afterPermissions = useCallback(async (): Promise<Step> => {
    if (!permissionsReady()) return 'permissions';
    if (isNativeBlockingAvailable() && !(await notificationsAllowed())) return 'permissions';
    return 'choose';
  }, []);

  const begin = useCallback(async (local: LocalChallenge) => {
    if (startedRef.current) return;
    startedRef.current = true;
    const next = await onChallengeRunning(local);
    onStartedRef.current(next);
  }, []);

  // Pick up where this account left off: a squad lobby it's sitting in, or
  // a challenge that's already running (reinstall / another phone).
  // The screen the person is on, for the late answer below.
  const stepRef = useRef<Step>('loading');
  stepRef.current = step;
  // After a moment on the spinner, say what is happening.
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    if (step !== 'loading') { setSlowLoad(false); return; }
    const t = setTimeout(() => setSlowLoad(true), 1500);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    let alive = true;
    const resume = (local: LocalChallenge | null): boolean => {
      if (local?.status === 'lobby') {
        setLobby(local);
        setApps(local.apps.length ? local.apps : DEFAULT_CHALLENGE_APPS);
        setStep('lobby');
        return true;
      }
      if (local?.status === 'active') {
        void begin(local);
        return true;
      }
      return false;
    };
    void (async () => {
      let local = await loadLocalChallenge();
      // The server lookup is capped at a few seconds. It used to hold this
      // spinner for up to 10, on every visit. A slow server no longer holds
      // the screen: the first step shows, and if the answer arrives later
      // with a challenge this account is already in, it takes the person
      // there (below).
      const lookup = fetchMyLatestChallenge().catch(() => null);
      const fetched = await Promise.race([
        lookup,
        new Promise<null>(resolve => setTimeout(() => resolve(null), SERVER_LOOKUP_MS)),
      ]);
      if (!alive) return;
      local = fetched ?? local;
      if (resume(local)) return;
      setStep((await hasLockInConsent()) ? await afterPermissions() : 'disclosure');
      void lookup.then(late => {
        if (!alive || !late || startedRef.current) return;
        const s = stepRef.current;
        if (s === 'loading' || s === 'disclosure' || s === 'permissions' || s === 'choose') resume(late);
      });
    })();
    return () => { alive = false; };
  }, [afterPermissions, begin]);

  // Permission screens are in Android Settings: re-check on coming back.
  const refreshGrants = useCallback(() => {
    setGrants({
      usageAccess: checkPermission('usageAccess') === true,
      overlay: checkPermission('overlay') === true,
    });
    void notificationsAllowed().then(setNotifGranted);
  }, []);
  useEffect(() => {
    refreshGrants();
    const sub = RNAppState.addEventListener('change', s => {
      if (s === 'active') refreshGrants();
    });
    return () => sub.remove();
  }, [refreshGrants]);

  // Live lobby: who's in, and whether the creator pressed Start.
  useEffect(() => {
    if (step !== 'lobby' || !lobby) return;
    let alive = true;
    const tick = async () => {
      try {
        const [fresh, list] = await Promise.all([refreshChallenge(lobby), fetchMembers(lobby.id)]);
        if (!alive) return;
        if (!fresh) {
          Alert.alert('Squad closed', 'The person who made this squad closed it.');
          setLobby(null);
          setStep('choose');
          return;
        }
        setMembers(list);
        if (fresh.status === 'active') void begin(fresh);
      } catch {
        // Offline for a moment: try again on the next tick.
      }
    };
    void tick();
    const id = setInterval(() => void tick(), LOBBY_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [step, lobby, begin]);

  const agree = async () => {
    void buttonPress();
    await setLockInConsent();
    setStep(await afterPermissions());
  };

  const grant = async (permission: BlockingPermission) => {
    void buttonPress();
    try {
      await openPermissionSettings(permission);
    } catch {
      Alert.alert('Not available', 'This permission can only be granted on the Android app.');
    }
  };

  // Required to start a challenge: its notification is how the person sees
  // it is live. (Blocking itself would still run without it, but Android can
  // then hide the notification.)
  const askNotifications = async () => {
    void buttonPress();
    await askForNotifications();
    refreshGrants();
  };

  // A challenge cannot start while notifications are off, even if they were
  // on earlier in this flow and got switched off since. Sends the person back
  // to the permissions step. Always false where there is no native blocker.
  const blockedByNotifications = async (): Promise<boolean> => {
    if (!isNativeBlockingAvailable() || (await notificationsAllowed())) return false;
    setNotifGranted(false);
    setStep('permissions');
    return true;
  };

  const openBatterySettings = async () => {
    void buttonPress();
    if (Platform.OS !== 'android') return;
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
    } catch {}
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    if (apps.length === 0) {
      Alert.alert('Pick at least one app', 'Choose the apps you want blocked for the 7 days.');
      return;
    }
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      Alert.alert("Couldn't do that", challengeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startSolo = () => run(async () => {
    if (await blockedByNotifications()) return;
    const local = await createChallenge('solo', apps, startTimeFor(startChoice));
    await begin(local);
  });

  const createSquad = () => run(async () => {
    if (await blockedByNotifications()) return;
    const local = await createChallenge('squad', apps, null);
    setLobby(local);
    setStep('lobby');
  });

  const joinSquad = () => {
    if (code.trim().length < 6) {
      Alert.alert('Enter the code', 'Squad codes are 6 letters and numbers.');
      return;
    }
    void run(async () => {
      if (await blockedByNotifications()) return;
      const local = await joinChallenge(code.trim(), apps);
      setLobby(local);
      setStep('lobby');
    });
  };

  const pressStart = () => {
    if (!lobby) return;
    void buttonPress();
    Alert.alert(
      'Start the 7 days?',
      'Everyone in the squad starts now, and nobody else can join after this.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => void run(async () => {
            await startSquad(lobby.id);
            const fresh = await refreshChallenge(lobby);
            if (fresh) await begin(fresh);
          }),
        },
      ],
    );
  };

  const leave = () => {
    if (!lobby) return;
    Alert.alert(
      lobby.isCreator ? 'Close this squad?' : 'Leave this squad?',
      lobby.isCreator ? 'Everyone waiting in the lobby will be removed.' : 'You can join again with the code.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: lobby.isCreator ? 'Close' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveLobby(lobby.id);
            } catch {}
            setLobby(null);
            setMembers([]);
            setStep('choose');
          },
        },
      ],
    );
  };

  const shareCode = async () => {
    if (!lobby) return;
    void buttonPress();
    try {
      await Share.share({
        message: `Lock in with me for 7 days. No reels, no shorts. Get TINT and join my squad with code ${lobby.code}`,
      });
    } catch {}
  };

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: onLogout },
    ]);
  };

  // The phone's Back button goes to the previous step, the same place the
  // on-screen links go. On the first step (and while loading) it does nothing
  // special, so Android leaves the app as usual: nobody is ever trapped, and
  // no step can send the user in a circle.
  useEffect(() => {
    const previous: Partial<Record<Step, Step>> = {
      permissions: 'disclosure',
      // The permissions step is skipped when both are already on, so go back
      // to whichever screen the user actually came from.
      choose: permissionsReady() && (!isNativeBlockingAvailable() || notifGranted) ? 'disclosure' : 'permissions',
      solo: 'choose',
      squad: 'choose',
      create: 'squad',
      join: 'squad',
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const to = previous[step];
      if (!to) return false;
      setStep(to);
      return true;
    });
    return () => sub.remove();
  }, [step, notifGranted]);

  const back = (to: Step) => (
    <TouchableOpacity onPress={() => setStep(to)} style={styles.back} hitSlop={12}>
      <Ionicons name="chevron-back" size={22} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  if (step === 'loading') {
    return (
      <View style={[cs.screen, styles.center]}>
        <StatusBar style="light" />
        <ActivityIndicator color={Colors.pop} />
        {slowLoad && <Text style={[cs.sub, styles.loadingHint]}>Checking your account...</Text>}
      </View>
    );
  }

  return (
    <View style={cs.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={cs.content} keyboardShouldPersistTaps="handled">
        {step === 'disclosure' && (
          <>
            <Eyebrow>Before you start</Eyebrow>
            <Text style={cs.title}>How the 7 Day Lock In works</Text>
            <View style={cs.card}>
              <Text style={styles.discLine}>• <Text style={styles.discBold}>It runs all day, for 7 days,</Text> even when TINT is closed, with a notification up while it runs. It restarts if your phone restarts.</Text>
              <Text style={styles.discLine}>• <Text style={styles.discBold}>How it blocks:</Text> Usage access shows TINT which app is open, and Display over other apps covers the ones you picked. TINT doesn't upload a list of your apps or what you open.</Text>
              <Text style={styles.discLine}>• <Text style={styles.discBold}>Saved to your account,</Text> only you can see it, for your end report: how many times you tried to open each blocked app each day, and, for those apps only, how many times and how long you used them in the 7 days before you start.</Text>
              <Text style={styles.discLine}>• <Text style={styles.discBold}>Others can see:</Text> squad members see your username, avatar, picked apps, whether you're in or have left, when you joined or left, and when your phone last checked in. The leaderboard shows your username, avatar, streak and focus minutes.</Text>
              <Text style={styles.discLine}>• <Text style={styles.discBold}>You're in control:</Text> 2 emergency unlocks of 5 minutes, leave any time, delete your account any time.</Text>
            </View>
            <Text style={styles.discConsent}>By tapping "I agree", you allow TINT to use these permissions and save this data for the 7 Day Lock In.</Text>
            <PrimaryButton label="I agree, continue" onPress={() => void agree()} />
            <TouchableOpacity onPress={openPrivacyPolicy} hitSlop={8}>
              <Text style={cs.link}>Read the privacy policy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmLogout} hitSlop={8}>
              <Text style={cs.link}>Not now</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'permissions' && (
          <>
            <Eyebrow>Before you start</Eyebrow>
            <Text style={cs.title}>Let TINT block apps</Text>
            <Text style={cs.sub}>Two Android settings, as explained on the last screen, and notifications. TINT uses the settings to see when one of your picked apps is opened, and cover it.</Text>
            <PermissionRow
              title="Usage access"
              body="Lets TINT see which app is open."
              granted={grants.usageAccess}
              onPress={() => void grant('usageAccess')}
            />
            <PermissionRow
              title="Display over other apps"
              body="Lets TINT show the block screen."
              granted={grants.overlay}
              onPress={() => void grant('overlay')}
            />
            <PermissionRow
              title="Notifications (required)"
              body="Lets you see your 7 Day Lock In is live and how much time is left. TINT also sends two short reminders a day and one when it ends. No ads."
              granted={notifGranted}
              onPress={() => void askNotifications()}
            />
            <PermissionRow
              title="Battery: Unrestricted (recommended)"
              body="Find TINT and set it to Unrestricted, so your phone doesn't stop the block."
              granted={false}
              optional
              onPress={() => void openBatterySettings()}
            />
            <PrimaryButton
              label="Continue"
              disabled={!(grants.usageAccess && grants.overlay && notifGranted) && isNativeBlockingAvailable()}
              onPress={() => setStep('choose')}
            />
            <TouchableOpacity onPress={() => setStep('disclosure')} hitSlop={8}>
              <Text style={cs.link}>Not now</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'choose' && (
          <>
            <Eyebrow>7 Day Lock In</Eyebrow>
            <Text style={cs.title}>How do you want to do it?</Text>
            <ChoiceCard
              icon="person"
              title="Go solo"
              body="Just you and 7 days."
              onPress={() => { void buttonPress(); setStep('solo'); }}
            />
            <ChoiceCard
              icon="people"
              title="Go with a squad"
              body={`Up to ${MAX_SQUAD} friends, one code.`}
              onPress={() => { void buttonPress(); setStep('squad'); }}
            />
            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={confirmLogout} hitSlop={8}>
                <Text style={cs.link}>Log out</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openPrivacyPolicy} hitSlop={8}>
                <Text style={cs.link}>Privacy policy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDeleteAccount(onAccountDeleted)} hitSlop={8}>
                <Text style={[cs.link, styles.danger]}>Delete account</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 'solo' && (
          <>
            {back('choose')}
            <Eyebrow>Solo</Eyebrow>
            <Text style={cs.title}>What gets blocked?</Text>
            <AppPicker selected={apps} onChange={setApps} />
            <Text style={cs.label}>WHEN DO YOU START?</Text>
            <View style={styles.startRow}>
              {([['now', 'Now'], ['tonight', 'Tonight 9 PM'], ['tomorrow', 'Tomorrow 7 AM']] as const).map(([id, label]) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.startChip, startChoice === id && styles.startChipOn]}
                  onPress={() => setStartChoice(id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.startChipText, startChoice === id && styles.startChipTextOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <PrimaryButton label="Start my 7 days" onPress={() => void startSolo()} loading={busy} />
          </>
        )}

        {step === 'squad' && (
          <>
            {back('choose')}
            <Eyebrow>Squad</Eyebrow>
            <Text style={cs.title}>Start one or join one</Text>
            <ChoiceCard
              icon="add-circle"
              title="Make a squad"
              body="Get a code to send your friends."
              onPress={() => { void buttonPress(); setStep('create'); }}
            />
            <ChoiceCard
              icon="key"
              title="I have a code"
              body="Join a friend's squad."
              onPress={() => { void buttonPress(); setStep('join'); }}
            />
          </>
        )}

        {step === 'create' && (
          <>
            {back('squad')}
            <Eyebrow>Make a squad</Eyebrow>
            <Text style={cs.title}>What do you want blocked?</Text>
            <Text style={cs.sub}>Everyone picks their own apps.</Text>
            <AppPicker selected={apps} onChange={setApps} />
            <PrimaryButton label="Make my squad" onPress={() => void createSquad()} loading={busy} />
          </>
        )}

        {step === 'join' && (
          <>
            {back('squad')}
            <Eyebrow>Join a squad</Eyebrow>
            <Text style={cs.title}>Enter the code</Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={t => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />
            <Text style={cs.label}>WHAT DO YOU WANT BLOCKED?</Text>
            <AppPicker selected={apps} onChange={setApps} />
            <PrimaryButton label="Join squad" onPress={joinSquad} loading={busy} />
          </>
        )}

        {step === 'lobby' && lobby && (
          <>
            <Eyebrow>Squad lobby</Eyebrow>
            <Text style={cs.title}>Get your friends in</Text>
            <View style={[cs.card, styles.codeCard]}>
              <Text style={cs.label}>SQUAD CODE</Text>
              <Text style={styles.code}>{lobby.code}</Text>
              <SecondaryButton label="Share code" onPress={() => void shareCode()} />
            </View>
            <View style={cs.card}>
              <Text style={cs.label}>IN THE SQUAD · {members.length}/{MAX_SQUAD}</Text>
              {members.map(m => (
                <View key={m.user_id} style={styles.memberRow}>
                  <View style={styles.memberAvatar}><PixelIcon name={m.avatar} size={26} /></View>
                  <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                </View>
              ))}
              {members.length === 0 && <ActivityIndicator color={Colors.pop} />}
            </View>
            {lobby.isCreator ? (
              <PrimaryButton label="Start the 7 days" onPress={pressStart} loading={busy} />
            ) : (
              <Text style={[cs.sub, styles.waiting]}>Waiting for the squad creator to start…</Text>
            )}
            <TouchableOpacity onPress={leave} hitSlop={8}>
              <Text style={cs.link}>{lobby.isCreator ? 'Close squad' : 'Leave squad'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const ChoiceCard: React.FC<{ icon: keyof typeof Ionicons.glyphMap; title: string; body: string; onPress: () => void }> = ({ icon, title, body, onPress }) => (
  <TouchableOpacity style={[cs.card, styles.choice]} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.choiceIcon}><Ionicons name={icon} size={22} color={Colors.pop} /></View>
    <View style={styles.choiceText}>
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text style={cs.sub}>{body}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
  </TouchableOpacity>
);

const PermissionRow: React.FC<{ title: string; body: string; granted: boolean; optional?: boolean; onPress: () => void }> = ({ title, body, granted, optional, onPress }) => (
  <View style={[cs.card, styles.permRow]}>
    <View style={styles.choiceText}>
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text style={cs.sub}>{body}</Text>
    </View>
    {granted ? (
      <Ionicons name="checkmark-circle" size={26} color={Colors.success} />
    ) : (
      <TouchableOpacity style={[styles.grantBtn, optional && styles.grantBtnOptional]} onPress={onPress} activeOpacity={0.8}>
        <Text style={[styles.grantText, optional && styles.grantTextOptional]}>{optional ? 'Open' : 'Allow'}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingHint: { marginTop: Spacing.md, textAlign: 'center' },
  back: { marginBottom: -Spacing.sm, alignSelf: 'flex-start' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  choiceIcon: {
    width: 44, height: 44, borderRadius: BorderRadius.sm, backgroundColor: Colors.popGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.textPrimary },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  grantBtn: { backgroundColor: Colors.pop, borderRadius: BorderRadius.full, paddingVertical: 8, paddingHorizontal: 16 },
  grantBtnOptional: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.border },
  grantText: { fontSize: 13, fontFamily: Fonts.bold, color: '#000' },
  grantTextOptional: { color: Colors.textPrimary },
  startRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  startChip: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: BorderRadius.full,
    borderWidth: 2, borderColor: Colors.border,
  },
  startChipOn: { backgroundColor: Colors.pop, borderColor: Colors.pop },
  startChipText: { fontSize: 13, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  startChipTextOn: { color: '#000' },
  codeInput: {
    fontFamily: Fonts.pixel, fontSize: 40, letterSpacing: 8, color: Colors.textPrimary, textAlign: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 2, borderColor: Colors.border,
    paddingVertical: Spacing.md,
  },
  codeCard: { alignItems: 'stretch' },
  code: { fontFamily: Fonts.pixel, fontSize: 56, letterSpacing: 10, color: Colors.pop, textAlign: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  memberName: { flex: 1, fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  waiting: { textAlign: 'center' },
  discLine: { fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular, color: Colors.textSecondary },
  discConsent: { fontSize: 13, lineHeight: 19, fontFamily: Fonts.medium, color: Colors.textPrimary },
  discBold: { fontFamily: Fonts.bold, color: Colors.textPrimary },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, flexWrap: 'wrap' },
  danger: { color: Colors.danger },
});
