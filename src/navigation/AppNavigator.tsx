import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, AppState as RNAppState } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '../constants/theme';
import { WalkthroughScreen } from '../screens/WalkthroughScreen';
import { AvatarExamScreen } from '../screens/AvatarExamScreen';
import { FocusGoalScreen } from '../screens/FocusGoalScreen';
import { CreateAccountScreen } from '../screens/CreateAccountScreen';
import { TodoScreen } from '../screens/TodoScreen';
import { FocusScreen } from '../screens/FocusScreen';
import { ProductivityScreen } from '../screens/ProductivityScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ChallengeIntroScreen } from '../screens/ChallengeIntroScreen';
import { ChallengeSetupScreen } from '../screens/ChallengeSetupScreen';
import { ChallengeHomeScreen } from '../screens/ChallengeHomeScreen';
import { clearLocalChallenge, cancelChallengeNotifications, loadLocalChallenge, armChallengeBlocking } from '../utils/challenge';
import { StorageService, AppState, UserProfile, FutureGoal } from '../utils/storage';
import { ExamType, CustomExam, ClassTwelveStream } from '../data/examPresets';
import { supabase } from '../lib/supabase';
import { FocusSessionProvider, useFocusSessionStatus } from '../context/FocusSessionContext';
import { FocusMiniPlayer } from '../components/FocusMiniPlayer';
import { loadDevOffset, subscribeDevClock } from '../utils/devClock';
import { saveFocusLog, loadFocusLog, saveBestFlameMins } from '../utils/focusLog';
import { saveDistractionLog } from '../utils/distractionLog';
import { clearActiveSession } from '../utils/activeFocusSession';
import { stopAppBlocking } from '../utils/appBlocking';
import { buildYesterdayRecap, hasShownRecapFor, markRecapShown, DailyRecapData } from '../utils/dailyRecap';
import { DailyRecapCard } from '../components/DailyRecapCard';
import { getTodaysMotivationalMessage } from '../utils/motivation';
import { MotivationalMessage } from '../data/motivationalMessages';
import { MotivationalPostcard } from '../components/MotivationalPostcard';
import { SplashAnimation } from '../components/SplashAnimation';
import {
  loadUserFromSupabase,
  syncAppStateToSupabase,
  saveNewUserToSupabase,
  lastLoadUserError,
} from '../utils/supabaseStorage';

// Supabase auth is fully wired up — returning users go straight back into
// the app instead of onboarding. (This used to force onboarding on every
// launch during early development, before real accounts existed.)
const FORCE_ONBOARDING_ON_LAUNCH = false;

// Bounds any promise to at most `ms` — used below so a slow/flaky network
// on boot degrades to the local-storage fallback path within a bounded time
// instead of leaving the app on a blank screen indefinitely. Supabase's
// client has no built-in request timeout, and a stalled mobile connection
// can leave a bare `await` hanging for minutes with nothing on screen.
//
// This does NOT cancel the underlying request (no AbortController hook
// available here) — it just stops waiting on it. This project is hosted in
// Seoul; testing from much further away can genuinely take this long per
// request on a real mobile connection, so too short a bound here doesn't
// make things safer, it just makes the app give up on requests that were
// actually going to succeed a few seconds later. 20s (was 6-8s) is a
// deliberately generous bound for exactly that reason.
const REMOTE_TIMEOUT_MS = 20000;

// The one place startup really has to wait on the network: a phone with no
// saved account. The splash used to sit on its last frame for up to 40
// seconds there (two 20-second waits). Now the whole wait shares one short
// budget, and running out of it shows "Try again" instead of a frozen screen.
// A phone that already has a saved account never waits at all (it goes
// straight in and checks the server in the background, with the generous
// bound above).
const BOOT_NETWORK_BUDGET_MS = 6000;
const TIMED_OUT = Symbol('timed-out');
function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null | typeof TIMED_OUT> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(TIMED_OUT), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(null); },
    );
  });
}
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

// This project has "Allow anonymous sign-ins" turned off in Supabase, so
// signInAnonymously() would always fail — every device relies entirely on
// an explicit signup/login to get a session; there's no silent fallback
// session before that. This just reads whatever's already persisted
// locally, if anything.
async function ensureSession(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user.id ?? null;
  } catch (err) {
    console.error('[AppNavigator] getSession() threw:', err);
    return null;
  }
}

type Screen =
  | 'boot' | 'walkthrough' | 'avatarExam' | 'focusGoal' | 'createAccount'
  | 'todo' | 'focus' | 'productivity' | 'leaderboard' | 'profile'
  | 'challengeIntro' | 'challengeSetup' | 'challengeHome';

const TAB_CONFIG = [
  { id: 'todo' as Screen, label: 'Today', icon: 'checkbox' as const },
  { id: 'focus' as Screen, label: 'Focus', icon: 'flash' as const },
  { id: 'productivity' as Screen, label: 'Progress', icon: 'stats-chart' as const },
  { id: 'leaderboard' as Screen, label: 'Rank', icon: 'trophy' as const },
];

// showTabs stays true for the rest of the session once a profile exists, but
// the bottom tab bar must not paint over onboarding screens — every launch
// goes through onboarding now (see FORCE_ONBOARDING_ON_LAUNCH below), so
// this fires on ordinary use, not just first installs.
const ONBOARDING_SCREENS = new Set<Screen>([
  'walkthrough', 'avatarExam', 'focusGoal', 'createAccount',
  // The 7 Day Lock In is its own small app inside TINT: no tab bar, and the
  // Today/Focus screens stay unmounted while it's on screen.
  'challengeIntro', 'challengeSetup', 'challengeHome',
]);

// People who came in through the 7 Day Lock In button never picked an exam.
function isChallengeOnly(user: UserProfile | null | undefined): boolean {
  return !!user && (user.examTypes?.length ?? 0) === 0 && !user.customExam;
}

interface OnboardingDraft {
  avatar: string;
  examTypes: ExamType[];
  customExam?: CustomExam;
  classTwelveStream?: ClassTwelveStream;
  dailyFocusGoalMins: number;
  name: string;
  email: string;
  futureGoal?: FutureGoal;
  /** Came in through the 7 Day Lock In button. */
  challengePath?: boolean;
}

export const AppNavigator: React.FC = () => (
  <FocusSessionProvider>
    <AppNavigatorInner />
  </FocusSessionProvider>
);

const AppNavigatorInner: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('boot');
  const [appState, setAppState] = useState<AppState>({
    user: null,
    streak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    history: [],
    totalTasksCompleted: 0,
  });
  const [showTabs, setShowTabs] = useState(false);
  // The boot screen's splash animation and the async session/data resolution
  // below run in parallel — the actual transition away from 'boot' waits for
  // BOTH (see the effect further down), so the animation always gets to play
  // its full length even when the network is fast, and a slow network just
  // holds on the animation's final frame instead of an extra loading state.
  const [bootTargetScreen, setBootTargetScreen] = useState<Screen | null>(null);
  const [splashAnimDone, setSplashAnimDone] = useState(false);
  // True when startup could not reach the server in time (see
  // BOOT_NETWORK_BUDGET_MS). bootAttempt re-runs the startup check.
  const [bootSlow, setBootSlow] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  // The "Already have an account? Log in" shortcut on step 1 skips straight
  // to createAccount in login mode, without collecting avatar/exam/goal —
  // this flag is what tells createAccount which mode to open in.
  const [loginShortcut, setLoginShortcut] = useState(false);
  const [recapData, setRecapData] = useState<DailyRecapData | null>(null);
  const recapCheckedRef = useRef(false);
  const [motivationMessage, setMotivationMessage] = useState<MotivationalMessage | null>(null);
  const motivationCheckedRef = useRef(false);
  const tabFadeAnim = useRef(new Animated.Value(0)).current;
  const userIdRef = useRef<string | null>(null);
  const { status: focusStatus, requestExpand } = useFocusSessionStatus();
  const draftRef = useRef<OnboardingDraft>({ avatar: 'star', examTypes: [], dailyFocusGoalMins: 60, name: '', email: '' });
  // A challenge user, already signed in, picking exams to use regular TINT.
  const upgradingFromChallengeRef = useRef(false);

  // Once per app-open (guarded by the ref, same pattern as the recap check
  // below), pops today's motivational postcard if it hasn't been shown yet.
  // Deliberately run AFTER the recap check resolves (either nothing to show,
  // or once the recap card is dismissed) so the two never stack.
  const checkMotivation = async () => {
    if (motivationCheckedRef.current || !appState.user) return;
    motivationCheckedRef.current = true;
    const message = await getTodaysMotivationalMessage();
    if (message) setMotivationMessage(message);
  };

  // Checks once per app-open (guarded by the ref, not just `showTabs`,
  // since appState updates constantly from ordinary task toggles) whether
  // yesterday's recap hasn't been shown yet, and pops it if so.
  useEffect(() => {
    if (!showTabs || recapCheckedRef.current || !appState.user) return;
    recapCheckedRef.current = true;
    void (async () => {
      const focusLog = await loadFocusLog();
      const recap = buildYesterdayRecap(appState, focusLog);
      if (recap && !(await hasShownRecapFor(recap.dateKey))) {
        setRecapData(recap);
      } else {
        void checkMotivation();
      }
    })();
  }, [showTabs, appState]);

  // Resolves session/local state while the boot screen's splash animation
  // plays — sets bootTargetScreen (not screen directly) so the gating
  // effect below can hold off actually navigating until the animation has
  // ALSO finished playing (see that effect for why).
  //
  // Local-first, network-second: this used to always await the cloud
  // fetch before deciding bootTargetScreen at all, so the splash's fixed
  // 2.5s animation was only ever the *minimum* wait, not the actual one —
  // on a slow connection the screen sat there well past it, reported as
  // the splash "still getting stuck" even after it was made to keep
  // breathing instead of freezing solid. AsyncStorage reads below are
  // local disk, not network — they resolve in a handful of milliseconds,
  // so checking local storage FIRST and deciding the target screen from
  // that means the overwhelming majority of real launches (this device,
  // same account, same key across every test build so local storage
  // survives an APK update) land on 'todo' well within the animation's own
  // 2.5s, every time. The cloud fetch still happens — just afterward, in
  // the background, correcting appState in place if the account has
  // newer data (e.g. synced from another device) without ever blocking
  // the transition on it. Only a device with truly no local user at all
  // (first launch, or a fresh install with no local cache but a real
  // cloud account) still has to wait on the network, since there's
  // nothing local to show either way.
  useEffect(() => {
    void (async () => {
      // Must resolve before anything below reads "today" — otherwise a
      // saved dev day-skip offset wouldn't apply until the next reload.
      await loadDevOffset();
      setBootSlow(false);

      if (!FORCE_ONBOARDING_ON_LAUNCH) {
        const localState = await StorageService.getAppState();
        const localUser = await StorageService.getUser();
        if (localUser) {
          setAppState(localState);
          if (isChallengeOnly(localUser)) {
            setBootTargetScreen('challengeHome');
          } else {
            setShowTabs(true);
            setBootTargetScreen('todo');
          }
          void (async () => {
            const userId = await withTimeout(ensureSession(), REMOTE_TIMEOUT_MS, null);
            userIdRef.current = userId;
            if (!userId) return;
            const loaded = await withTimeout(loadUserFromSupabase(userId), REMOTE_TIMEOUT_MS, null);
            if (loaded) {
              setAppState(loaded);
            } else {
              // Existing local user with no cloud row yet (e.g. was offline before) — push it up now
              void saveNewUserToSupabase(userId, '', localUser);
            }
          })();
          return;
        }

        // No local user on this device — genuinely nothing to show without
        // asking the network first.
        const deadline = Date.now() + BOOT_NETWORK_BUDGET_MS;
        const timeLeft = () => Math.max(500, deadline - Date.now());
        const sessionResult = await raceTimeout(ensureSession(), timeLeft());
        if (sessionResult === TIMED_OUT) {
          setBootSlow(true);
          return;
        }
        const userId = sessionResult;
        userIdRef.current = userId;
        if (userId) {
          // Was a separate checkUserExists() + loadUserFromSupabase() pair —
          // an extra network round trip for no benefit, since a "yes" answer
          // was always immediately followed by loading the full row anyway.
          // It also silently conflated "definitely no such user" with "the
          // check itself failed" (any non-not-found error returned false
          // too), which could send a genuine returning user down the
          // brand-new-user path over a transient network hiccup.
          // loadUserFromSupabase already returns null for both cases and
          // is the one path actually exercised/trusted elsewhere.
          const loadedResult = await raceTimeout(loadUserFromSupabase(userId), timeLeft());
          if (loadedResult === TIMED_OUT) {
            setBootSlow(true);
            return;
          }
          const loaded = loadedResult;
          if (loaded) {
            setAppState(loaded);
            if (isChallengeOnly(loaded.user)) {
              setBootTargetScreen('challengeHome');
            } else {
              setShowTabs(true);
              setBootTargetScreen('todo');
            }
            return;
          }
        }
      }

      // The one genuinely "first launch" branch — no cloud profile, no local
      // user either. Onboarding now starts with avatar/exam, then account
      // creation, then the walkthrough right before landing in the app.
      setBootTargetScreen('avatarExam');
    })();
    // bootAttempt: "Try again" on the slow-connection notice re-runs this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootAttempt]);

  // Actually leaves the boot screen once BOTH the async resolution above and
  // the splash animation have finished — whichever takes longer wins. Fast
  // network: the animation still plays out in full instead of getting cut
  // short. Slow network: the animation just holds on its final frame (see
  // SplashAnimation) instead of an extra bare loading state after it.
  useEffect(() => {
    if (!bootTargetScreen || !splashAnimDone) return;
    setScreen(bootTargetScreen);
    if (bootTargetScreen === 'todo') {
      Animated.timing(tabFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [bootTargetScreen, splashAnimDone, tabFadeAnim]);

  // Keep a running 7 Day Lock In armed whenever TINT opens or comes back to
  // the front, for every kind of account. Only challenge-only accounts open on
  // the Lock In screen (which re-arms it); everyone else lands on the tabs, so
  // a challenge that Android's battery rules had stopped stayed off until the
  // Lock In screen happened to be opened. Safe to repeat: re-arming the same
  // challenge changes nothing, and the phone's own copy is used, so it works
  // offline. Does nothing when no challenge is saved on this phone.
  useEffect(() => {
    const rearm = async () => {
      try {
        const local = await loadLocalChallenge();
        if (local && local.status === 'active') armChallengeBlocking(local);
      } catch {
        // Never let this affect startup.
      }
    };
    void rearm();
    const sub = RNAppState.addEventListener('change', s => {
      if (s === 'active') void rearm();
    });
    return () => sub.remove();
  }, []);

  // Tab screens stay mounted now, so the dev-mode day-skip tool needs an
  // explicit nudge to refresh appState (streak/history are date-dependent) —
  // nothing else would trigger a refetch once past the initial boot.
  useEffect(() => subscribeDevClock(() => {
    void StorageService.getAppState().then(setAppState);
  }), []);

  const navigateTo = (s: Screen) => setScreen(s);

  // Best-effort, quiet save of onboarding progress so far — called after
  // every remaining onboarding step (not just the last one). Before this,
  // the profile was only ever written anywhere — locally or to Supabase —
  // after the very last screen (the focus-goal dial's "Lock This In"). If a
  // signup got interrupted before that exact tap for any reason (closed the
  // app, backed out, anything), the account was fully authenticated but had
  // nothing saved anywhere — logging into it afterward correctly found
  // nothing, with no error to show, since nothing had actually failed. That
  // looked identical to "login is broken" from the outside. Saving
  // progressively means an account is loggable-into from the moment signup
  // succeeds, with sensible defaults for whatever hasn't been set yet.
  const saveOnboardingProgress = async (user: UserProfile) => {
    await StorageService.saveUser(user);
    const state = await StorageService.getAppState();
    await StorageService.saveAppState({ ...state, user });
    if (!userIdRef.current) {
      userIdRef.current = await withTimeout(ensureSession(), REMOTE_TIMEOUT_MS, null);
    }
    if (userIdRef.current) {
      void saveNewUserToSupabase(userIdRef.current, user.email, user);
    }
  };

  // Walkthrough's own final screen collects the one thing onboarding itself
  // never asked for — what they're actually using TINT to get to. Runs
  // right after signup, before the daily-focus-goal dial.
  const handleWalkthroughDone = (futureGoal?: FutureGoal) => {
    draftRef.current.futureGoal = futureGoal;
    setScreen('focusGoal');
    const { avatar, examTypes, customExam, classTwelveStream, name, email, dailyFocusGoalMins } = draftRef.current;
    void saveOnboardingProgress({
      name, email, examTypes, customExam, classTwelveStream, avatar, futureGoal: futureGoal ?? null,
      createdAt: new Date().toISOString(), dailyFocusGoalMins,
    });
  };

  // ── Onboarding flow: avatarExam -> createAccount -> walkthrough -> focusGoal ──
  const handleAvatarExamComplete = (data: { avatar: string; examTypes: ExamType[]; customExam?: CustomExam; classTwelveStream?: ClassTwelveStream }) => {
    draftRef.current.avatar = data.avatar;
    draftRef.current.examTypes = data.examTypes;
    draftRef.current.customExam = data.customExam;
    draftRef.current.classTwelveStream = data.classTwelveStream;
    draftRef.current.challengePath = false;
    // Already signed in (finished a challenge, now wants regular TINT):
    // skip account creation and go straight to the walkthrough.
    setScreen(upgradingFromChallengeRef.current ? 'walkthrough' : 'createAccount');
  };

  // ── 7 Day Lock In: avatarExam -> createAccount -> challengeIntro -> challengeSetup -> challengeHome ──
  const handleChallengeChosen = (avatar: string) => {
    draftRef.current.avatar = avatar;
    draftRef.current.examTypes = [];
    draftRef.current.customExam = undefined;
    draftRef.current.classTwelveStream = undefined;
    draftRef.current.challengePath = true;
    setScreen('createAccount');
  };

  const handleUpgradeFromChallenge = () => {
    const user = appState.user;
    if (user) {
      draftRef.current.name = user.name;
      draftRef.current.email = user.email;
      draftRef.current.avatar = user.avatar;
      draftRef.current.dailyFocusGoalMins = user.dailyFocusGoalMins ?? 60;
    }
    draftRef.current.challengePath = false;
    upgradingFromChallengeRef.current = true;
    setScreen('avatarExam');
  };

  // Same clean-up as the Profile screen's log out, plus the challenge's own
  // local copy and scheduled notifications.
  const handleChallengeLogout = async () => {
    supabase.auth.signOut().catch(() => {});
    await Promise.all([
      StorageService.clearAllUserData(),
      saveFocusLog([]),
      saveDistractionLog([]),
      saveBestFlameMins(0),
      clearActiveSession(),
      clearLocalChallenge(),
      cancelChallengeNotifications(),
    ]);
    handleLogout();
  };

  const handleLoginShortcut = () => {
    setLoginShortcut(true);
    setScreen('createAccount');
  };

  // ProfileScreen already signed out of Supabase and wiped local device
  // data before calling this — this just resets in-memory navigation state
  // and kicks off a fresh anonymous session, the same state a brand-new
  // install would boot into.
  const handleLogout = () => {
    // Belt-and-braces alongside the native service's own endAtMs self-stop
    // (see BlockingForegroundService) — a stray leftover session (app
    // killed mid-session, timer that never fired) shouldn't keep blocking
    // apps after the account that started it has logged out.
    stopAppBlocking();
    userIdRef.current = null;
    setShowTabs(false);
    setLoginShortcut(false);
    upgradingFromChallengeRef.current = false;
    draftRef.current.challengePath = false;
    setRecapData(null);
    recapCheckedRef.current = false;
    setMotivationMessage(null);
    motivationCheckedRef.current = false;
    setAppState({ user: null, streak: 0, longestStreak: 0, lastActiveDate: null, history: [], totalTasksCompleted: 0 });
    tabFadeAnim.setValue(0);
    setScreen('avatarExam');
    // No anonymous-session fallback to re-establish here (this project has
    // it disabled) — userIdRef just stays null until the next explicit
    // signup/login.
  };

  // Tail of onboarding — persists the full profile (avatar/exams from step 1,
  // name/email from signup, the future goal from the walkthrough, and the
  // daily-focus-goal minutes just set here), then lands in the app.
  const handleFocusGoalComplete = (mins: number) => {
    const { avatar, examTypes, customExam, classTwelveStream, name, email, futureGoal } = draftRef.current;
    finishOnboarding({
      name, email, examTypes, customExam, classTwelveStream, avatar, futureGoal: futureGoal ?? null,
      createdAt: new Date().toISOString(), dailyFocusGoalMins: mins,
    });
  };

  const finishOnboarding = (user: UserProfile) => {
    upgradingFromChallengeRef.current = false;
    // Defensive, same as logout's clearing — local storage isn't namespaced
    // per-account, so without this a brand-new signup on a device someone
    // else (or a previous test account) used could silently inherit a
    // leftover in-progress focus session and have it "auto-complete" the
    // moment the app opens, logging time the new account never spent focusing.
    void clearActiveSession();
    void saveFocusLog([]);
    void saveDistractionLog([]);
    void saveBestFlameMins(0);

    StorageService.saveUser(user)
      .then(() => StorageService.getAppState())
      .then(state => StorageService.saveAppState({ ...state, user }))
      .then(() => StorageService.getAppState())
      .then(async state => {
        setAppState(state);
        setShowTabs(true);
        setScreen('todo');
        Animated.timing(tabFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

        if (!userIdRef.current) {
          userIdRef.current = await withTimeout(ensureSession(), REMOTE_TIMEOUT_MS, null);
        }
        if (userIdRef.current && state.user) {
          // The email is already sitting on state.user — it was set from
          // the signup form itself (or is '' for a guest). Re-fetching it
          // via getUser() was a pointless extra network call (no timeout
          // on it either) standing between a successful signup and this
          // profile actually reaching Supabase.
          const result = await saveNewUserToSupabase(userIdRef.current, state.user.email, state.user);
          // This write silently failing (network, RLS, anything) is exactly
          // what's been making login look broken after a seemingly-successful
          // signup — the account authenticates fine but has no profile row,
          // so every later login finds "nothing to load" and bounces back to
          // onboarding. Surfacing it here means the *next* failure shows its
          // real cause instead of vanishing into a console no one can see on
          // a release build.
          if (!result.success) {
            Alert.alert(
              'Your account needs one more step',
              `Signed up, but your profile couldn't be saved yet: ${result.error ?? 'unknown error'}. You may need to sign up again once this is fixed, or check your connection.`
            );
          }
        } else if (!userIdRef.current) {
          Alert.alert(
            'Your account needs one more step',
            'Signed up, but no account id was available to save your profile against — please check your connection and try signing up again.'
          );
        }
      });
  };

  const handleSignedUp = ({ name, email, userId }: { name: string; email: string; userId?: string }) => {
    draftRef.current.name = name;
    draftRef.current.email = email;
    // Trust the id the signup call itself returned over whatever boot's
    // ensureSession() came up with — if that ran into the same slow/flaky
    // network this whole flow has been fighting, userIdRef could still be
    // null here, and finishOnboarding's own fallback re-fetch is one more
    // thing that could independently fail and leave the account with no
    // profile row at all.
    if (userId) userIdRef.current = userId;
    setScreen(draftRef.current.challengePath ? 'challengeIntro' : 'walkthrough');
    const { avatar, examTypes, customExam, classTwelveStream, dailyFocusGoalMins } = draftRef.current;
    const user: UserProfile = {
      name, email, examTypes, customExam, classTwelveStream, avatar, futureGoal: null,
      createdAt: new Date().toISOString(), dailyFocusGoalMins,
    };
    // The challenge path never reaches finishOnboarding, so the in-memory
    // profile is set here (the walkthrough path sets it at the end).
    if (draftRef.current.challengePath) setAppState(prev => ({ ...prev, user }));
    void saveOnboardingProgress(user);
  };

  const handleLoggedIn = async (hasProfile: boolean, userId?: string, googleEmail?: string) => {
    // signInWithPassword's own response already carries the user id — a
    // separate getUser() call here was a fully redundant network round
    // trip on every login, adding to the perceived delay for no reason.
    if (userId) {
      userIdRef.current = userId;
    } else {
      const TIMED_OUT = Symbol('timed-out');
      const result = await Promise.race([
        supabase.auth.getUser(),
        new Promise<typeof TIMED_OUT>(resolve => setTimeout(() => resolve(TIMED_OUT), REMOTE_TIMEOUT_MS)),
      ]);
      const user = result === TIMED_OUT ? null : result.data.user;
      userIdRef.current = user?.id ?? userIdRef.current;
    }

    if (hasProfile && userIdRef.current) {
      // Bounded the same way as the boot-time load — without this, a
      // slow/cold connection left the screen stuck on whatever it was
      // showing (createAccount, mid Google sign-in) with no error and no
      // way forward, since nothing here ever timed out on its own.
      // resetLocalLogs=true: same cross-account leak finishOnboarding
      // already guards against (local storage isn't namespaced per-account)
      // — but that only covered the fresh-signup path. Logging into an
      // *existing* account (this path, including Google) skipped it
      // entirely: whatever focus/distraction log a previous account left in
      // AsyncStorage on this device would silently blend into this
      // account's numbers the moment its next session completed (the
      // leaderboard's "3 hours showing as 7" bug — someone else's leftover
      // local minutes getting added on top of a real new session and pushed
      // straight to this account's own Supabase row). This makes
      // loadUserFromSupabase overwrite local focus/distraction logs with
      // this account's own synced history instead of leaving the stale
      // ones in place.
      const loaded = await withTimeout(loadUserFromSupabase(userIdRef.current, true), REMOTE_TIMEOUT_MS, null);
      if (loaded) {
        // Same reasoning, for the active-session descriptor: if a previous
        // account on this device left a focus session running when the app
        // got killed, its stale descriptor would still be sitting in
        // AsyncStorage, and the next time this newly-logged-in account
        // opened the Focus tab, FocusScreen would find that leftover
        // session past its planned end time and log its *full* duration as
        // a session this account never ran.
        void clearActiveSession();
        setAppState(loaded);
        if (isChallengeOnly(loaded.user)) {
          setScreen('challengeHome');
          return;
        }
        setShowTabs(true);
        setScreen('todo');
        Animated.timing(tabFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        return;
      }
      // Distinguishes "this account genuinely has no profile row" (send them
      // through onboarding, the existing behavior below) from "the read
      // itself failed" (network, RLS, a timeout) — the two used to look
      // identical from here, which is exactly why login bouncing back to
      // onboarding was impossible to diagnose without device logs.
      if (lastLoadUserError) {
        Alert.alert('Couldn\'t log in', `Your account exists, but loading its data failed: ${lastLoadUserError}. Check your connection and try again.`);
        return;
      }
      // No profile row, and this wasn't a Google sign-in (googleEmail is
      // only ever passed from that path) -- so this is the plain email/
      // password Log In form succeeding at authentication for an account
      // that never actually finished signing up (e.g. signup was
      // interrupted before its profile row got written). Silently routing
      // that into onboarding looked identical to a real brand-new signup,
      // with no indication anything was wrong — send them back to the
      // login screen with a clear explanation instead. Google sign-in
      // genuinely can be a real first-time user with no profile row yet,
      // so that path still correctly falls through to onboarding below.
      if (!googleEmail) {
        Alert.alert(
          'Account not fully set up',
          'This account was never finished signing up, so there\'s no profile to log into. Please sign up instead.'
        );
        return;
      }
    }
    // New Google account that came in through the 7 Day Lock In button:
    // it already picked an avatar, so treat this like finishing signup
    // instead of sending it back to the avatar/exam screen.
    if (googleEmail && draftRef.current.challengePath) {
      handleSignedUp({
        name: googleEmail.split('@')[0] || 'Friend',
        email: googleEmail,
        userId: userIdRef.current ?? undefined,
      });
      return;
    }
    // Logged in but no cloud profile row yet — run through the same
    // onboarding a brand-new signup goes through, starting from avatar/exam.
    if (googleEmail) draftRef.current.email = googleEmail;
    setLoginShortcut(false);
    setScreen('avatarExam');
  };

  const handleStateChange = (newState: AppState) => {
    StorageService.saveAppState(newState);
    setAppState(newState);
    if (userIdRef.current) {
      void syncAppStateToSupabase(userIdRef.current, newState);
    }
  };

  // Swipe left/right between tabs. activeOffsetX/failOffsetY mean the pan
  // only "wins" once the drag is clearly horizontal, so nested horizontal
  // scrollers (date strip, category chips) keep working normally.
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const goRelative = (direction: 1 | -1) => {
    const currentIndex = TAB_CONFIG.findIndex(t => t.id === screenRef.current);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < TAB_CONFIG.length) {
      navigateTo(TAB_CONFIG[nextIndex].id);
    }
  };

  // NOTE: this used to also compose with Gesture.Native() to try to stop it
  // competing with buttons for the touch responder — that broke vertical
  // scrolling on every screen instead (Gesture.Native() isn't meant to be
  // attached blanket-style over an arbitrary subtree with its own nested
  // ScrollViews; it's for pairing with one specific native-backed
  // component). Reverted to plain Pan with wide activation thresholds,
  // which is what actually keeps it from claiming ordinary taps/scrolls —
  // it only starts tracking once movement is clearly a deliberate
  // horizontal swipe.
  const swipeGesture = Gesture.Pan()
    .enabled(showTabs)
    .activeOffsetX([-35, 35])
    .failOffsetY([-20, 20])
    .onEnd(event => {
      'worklet';
      if (Math.abs(event.translationX) < 60) return;
      runOnJS(goRelative)(event.translationX < 0 ? 1 : -1);
    });

  // Mini-player shows whenever a session is actively running and its own
  // full-screen UI isn't the thing currently on screen (Focus tab for a
  // standalone session, Today's task-linked overlay for a task session) —
  // or the task session's overlay has been explicitly minimized back to
  // the task list while still running underneath.
  const focusUIOnScreen = !focusStatus.minimized && (
    (focusStatus.source === 'tab' && screen === 'focus')
    || (focusStatus.source === 'task' && screen === 'todo')
  );
  const miniPlayerVisible = focusStatus.active && !focusUIOnScreen;

  const handleMiniPlayerPress = () => {
    if (focusStatus.source === 'task') {
      navigateTo('todo');
      requestExpand();
    } else {
      navigateTo('focus');
    }
  };

  return (
    <View style={styles.root}>
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.swipeArea}>
          {screen === 'boot' && (
            <View style={styles.bootScreen}>
              <SplashAnimation onFinish={() => setSplashAnimDone(true)} />
              {bootSlow && (
                <View style={styles.bootSlowBox}>
                  <Text style={styles.bootSlowTitle}>Taking longer than usual</Text>
                  <Text style={styles.bootSlowBody}>
                    We could not reach the server. Check your internet connection.
                  </Text>
                  <TouchableOpacity
                    style={styles.bootSlowButton}
                    onPress={() => setBootAttempt(n => n + 1)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.bootSlowButtonText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          {screen === 'walkthrough' && (
            <WalkthroughScreen onDone={handleWalkthroughDone} />
          )}
          {screen === 'avatarExam' && (
            <AvatarExamScreen
              onComplete={handleAvatarExamComplete}
              onLogin={handleLoginShortcut}
              onChallenge={upgradingFromChallengeRef.current ? undefined : handleChallengeChosen}
              showLogin={!upgradingFromChallengeRef.current}
            />
          )}
          {screen === 'challengeIntro' && (
            <ChallengeIntroScreen
              avatar={appState.user?.avatar ?? draftRef.current.avatar}
              onDone={() => setScreen('challengeSetup')}
            />
          )}
          {screen === 'challengeSetup' && (
            <ChallengeSetupScreen
              onStarted={() => setScreen('challengeHome')}
              onLogout={() => void handleChallengeLogout()}
              onAccountDeleted={handleLogout}
            />
          )}
          {screen === 'challengeHome' && (
            <ChallengeHomeScreen
              onRestart={() => setScreen('challengeSetup')}
              onUpgrade={handleUpgradeFromChallenge}
              onAccountDeleted={handleLogout}
            />
          )}
          {screen === 'createAccount' && (
            <CreateAccountScreen
              onSignedUp={handleSignedUp}
              onLoggedIn={handleLoggedIn}
              onBack={loginShortcut ? undefined : () => setScreen('avatarExam')}
              initialMode={loginShortcut ? 'login' : 'signup'}
              avatar={draftRef.current.avatar}
            />
          )}
          {screen === 'focusGoal' && (
            <FocusGoalScreen onComplete={handleFocusGoalComplete} />
          )}
          {/* Today and Focus stay mounted (visibility toggled via
              display:none) instead of being swapped in and out of the tree —
              otherwise navigating away destroys their state, which is
              exactly what was happening to a running Focus session the
              moment you switched tabs. Progress and Rank don't hold any
              timer/session state worth preserving, so they stay simple
              mount-on-visit — keeping four heavy screens (charts, podium,
              animations) alive simultaneously all the time was the likely
              cause of the app feeling sluggish.

              Onboarding screens are the one exception: they fully unmount
              these two instead of just hiding them. Stacking a third heavy
              animated screen (the avatar wall) on top of two already-mounted
              ones was crashing on-device — this is a dev-only preview
              flow, so losing an in-progress session for the rare case where
              one happens to be running when it's opened is an acceptable
              trade for not crashing. */}
          {showTabs && !ONBOARDING_SCREENS.has(screen) && (
            <View style={[styles.tabScreenSlot, screen !== 'todo' && styles.hidden]}>
              <TodoScreen
                appState={appState}
                onStateChange={handleStateChange}
                userId={userIdRef.current ?? undefined}
                onNavigateFocus={() => navigateTo('focus')}
                onNavigateProfile={() => navigateTo('profile')}
                onNavigateAnalytics={() => navigateTo('productivity')}
              />
            </View>
          )}
          {showTabs && !ONBOARDING_SCREENS.has(screen) && (
            <View style={[styles.tabScreenSlot, screen !== 'focus' && styles.hidden]}>
              <FocusScreen
                userId={userIdRef.current ?? undefined}
                visible={screen === 'focus'}
                sessionSource="tab"
                onMinimize={() => navigateTo('todo')}
              />
            </View>
          )}
          {screen === 'productivity' && <ProductivityScreen appState={appState} />}
          {screen === 'leaderboard' && <LeaderboardScreen appState={appState} userId={userIdRef.current ?? undefined} />}
          {screen === 'profile' && (
            <ProfileScreen
              appState={appState}
              userId={userIdRef.current ?? undefined}
              onStateChange={handleStateChange}
              onBack={() => navigateTo('todo')}
              onLogout={handleLogout}
            />
          )}
        </View>
      </GestureDetector>

      {miniPlayerVisible && !ONBOARDING_SCREENS.has(screen) && screen !== 'profile' && (
        <FocusMiniPlayer
          title={focusStatus.title}
          timeLeft={focusStatus.timeLeft}
          paused={focusStatus.paused}
          onPress={handleMiniPlayerPress}
          bottomOffset={showTabs ? 100 : 24}
        />
      )}

      {showTabs && !ONBOARDING_SCREENS.has(screen) && (
        <Animated.View style={[styles.tabBar, { opacity: tabFadeAnim }]}>
          {TAB_CONFIG.map(tab => {
            const isActive = screen === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.tabItem}
                onPress={() => navigateTo(tab.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.tabIconContainer, isActive && styles.tabIconActive]}>
                  <Ionicons
                    name={isActive ? tab.icon : (`${tab.icon}-outline` as any)}
                    size={20}
                    color={isActive ? Colors.primary : Colors.textSecondary}
                  />
                </View>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {isActive && <View style={styles.tabDot} />}
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      )}

      {recapData && (
        <DailyRecapCard
          visible
          data={recapData}
          onClose={() => {
            void markRecapShown(recapData.dateKey);
            setRecapData(null);
            void checkMotivation();
          }}
        />
      )}

      <MotivationalPostcard
        visible={!!motivationMessage}
        message={motivationMessage}
        goalText={appState.user?.futureGoal?.text ?? null}
        onClose={() => setMotivationMessage(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  swipeArea: {
    flex: 1,
  },
  // Boot resolves within a few seconds even on a bad connection (see the
  // timeouts above), but rendering literally nothing here for that whole
  // stretch reads as the app being frozen rather than loading.
  bootScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  // "Taking longer than usual" notice, drawn over the bottom of the splash.
  bootSlowBox: {
    position: 'absolute', left: 24, right: 24, bottom: 64, alignItems: 'center',
  },
  bootSlowTitle: {
    color: Colors.textPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center',
  },
  bootSlowBody: {
    color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20,
  },
  bootSlowButton: {
    marginTop: 16, paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: BorderRadius.full, backgroundColor: Colors.pop,
  },
  bootSlowButtonText: {
    color: '#000', fontSize: 15, fontWeight: '700',
  },
  tabScreenSlot: {
    ...StyleSheet.absoluteFillObject,
  },
  hidden: {
    display: 'none',
  },
  tabBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingBottom: 12,
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabIconContainer: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabIconActive: {
    backgroundColor: Colors.primaryGlow,
  },
  tabLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: Colors.primaryLight,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
});
