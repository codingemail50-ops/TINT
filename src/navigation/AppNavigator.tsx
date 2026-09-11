import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Alert } from 'react-native';
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
import { StorageService, AppState, UserProfile, FutureGoal } from '../utils/storage';
import { ExamType, CustomExam } from '../data/examPresets';
import { supabase } from '../lib/supabase';
import { FocusSessionProvider, useFocusSessionStatus } from '../context/FocusSessionContext';
import { FocusMiniPlayer } from '../components/FocusMiniPlayer';
import { loadDevOffset, subscribeDevClock } from '../utils/devClock';
import { saveFocusLog, loadFocusLog } from '../utils/focusLog';
import { saveDistractionLog } from '../utils/distractionLog';
import { clearActiveSession } from '../utils/activeFocusSession';
import { stopAppBlocking } from '../utils/appBlocking';
import { buildYesterdayRecap, hasShownRecapFor, markRecapShown, DailyRecapData } from '../utils/dailyRecap';
import { DailyRecapCard } from '../components/DailyRecapCard';
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
// on boot degrades to the local-storage fallback path within a few seconds
// instead of leaving the app on a blank screen indefinitely. Supabase's
// client has no built-in request timeout, and a stalled mobile connection
// can leave a bare `await` hanging for minutes with nothing on screen.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

// Every device still gets an anonymous Supabase session created behind the
// scenes on first launch — signing up upgrades that same session to a real
// account (same user id) rather than discarding it, so a guest who later
// signs up doesn't lose anything already saved locally.
async function ensureSession(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session.user.id;
  } catch (err) {
    // getSession() throwing here (rather than just returning no session)
    // used to mean this whole function gave up and returned null — which
    // reads as "no session at all this launch", not just "no *persisted*
    // session". A returning user whose real session failed to restore for
    // a transient reason still deserves the same fallback attempt at
    // establishing *some* session that a fresh install gets below.
    console.error('[AppNavigator] getSession() threw, falling back to anonymous sign-in:', err);
  }

  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('[AppNavigator] Anonymous sign-in failed:', error.message);
      return null;
    }
    return data.session?.user.id ?? null;
  } catch (err) {
    console.error('[AppNavigator] signInAnonymously() exception:', err);
    return null;
  }
}

type Screen =
  | 'boot' | 'walkthrough' | 'avatarExam' | 'focusGoal' | 'createAccount'
  | 'todo' | 'focus' | 'productivity' | 'leaderboard' | 'profile';

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
const ONBOARDING_SCREENS = new Set<Screen>(['walkthrough', 'avatarExam', 'focusGoal', 'createAccount']);

interface OnboardingDraft {
  avatar: string;
  examTypes: ExamType[];
  customExam?: CustomExam;
  dailyFocusGoalMins: number;
  name: string;
  email: string;
  futureGoal?: FutureGoal;
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
  // The "Already have an account? Log in" shortcut on step 1 skips straight
  // to createAccount in login mode, without collecting avatar/exam/goal —
  // this flag is what tells createAccount which mode to open in.
  const [loginShortcut, setLoginShortcut] = useState(false);
  const [recapData, setRecapData] = useState<DailyRecapData | null>(null);
  const recapCheckedRef = useRef(false);
  const tabFadeAnim = useRef(new Animated.Value(0)).current;
  const userIdRef = useRef<string | null>(null);
  const { status: focusStatus, requestExpand } = useFocusSessionStatus();
  const draftRef = useRef<OnboardingDraft>({ avatar: 'star', examTypes: [], dailyFocusGoalMins: 60, name: '', email: '' });

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
      }
    })();
  }, [showTabs, appState]);

  // No splash animation — resolve session/local state directly on mount.
  useEffect(() => {
    void (async () => {
      // Must resolve before anything below reads "today" — otherwise a
      // saved dev day-skip offset wouldn't apply until the next reload.
      await loadDevOffset();
      const userId = await withTimeout(ensureSession(), 6000, null);
      userIdRef.current = userId;

      if (!FORCE_ONBOARDING_ON_LAUNCH) {
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
          const loaded = await withTimeout(loadUserFromSupabase(userId), 6000, null);
          if (loaded) {
            setAppState(loaded);
            setShowTabs(true);
            setScreen('todo');
            Animated.timing(tabFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
            return;
          }
        }

        // No cloud profile yet (brand-new anonymous user, or offline) — fall back to local storage
        const state = await StorageService.getAppState();
        setAppState(state);
        const user = await StorageService.getUser();
        if (user) {
          // Existing local user with no cloud row yet (e.g. was offline before) — push it up now
          if (userId) void saveNewUserToSupabase(userId, '', user);
          setShowTabs(true);
          setScreen('todo');
          Animated.timing(tabFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
          return;
        }
      }

      // The one genuinely "first launch" branch — no cloud profile, no local
      // user either. Onboarding now starts with avatar/exam, then account
      // creation, then the walkthrough right before landing in the app.
      setScreen('avatarExam');
    })();
  }, []);

  // Tab screens stay mounted now, so the dev-mode day-skip tool needs an
  // explicit nudge to refresh appState (streak/history are date-dependent) —
  // nothing else would trigger a refetch once past the initial boot.
  useEffect(() => subscribeDevClock(() => {
    void StorageService.getAppState().then(setAppState);
  }), []);

  const navigateTo = (s: Screen) => setScreen(s);

  // Walkthrough's own final screen collects the one thing onboarding itself
  // never asked for — what they're actually using TINT to get to. Runs
  // right after signup, before the daily-focus-goal dial.
  const handleWalkthroughDone = (futureGoal?: FutureGoal) => {
    draftRef.current.futureGoal = futureGoal;
    setScreen('focusGoal');
  };

  // ── Onboarding flow: avatarExam -> createAccount -> walkthrough -> focusGoal ──
  const handleAvatarExamComplete = (data: { avatar: string; examTypes: ExamType[]; customExam?: CustomExam }) => {
    draftRef.current.avatar = data.avatar;
    draftRef.current.examTypes = data.examTypes;
    draftRef.current.customExam = data.customExam;
    setScreen('createAccount');
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
    setRecapData(null);
    recapCheckedRef.current = false;
    setAppState({ user: null, streak: 0, longestStreak: 0, lastActiveDate: null, history: [], totalTasksCompleted: 0 });
    tabFadeAnim.setValue(0);
    setScreen('avatarExam');
    void ensureSession().then(id => { userIdRef.current = id; });
  };

  // Tail of onboarding — persists the full profile (avatar/exams from step 1,
  // name/email from signup, the future goal from the walkthrough, and the
  // daily-focus-goal minutes just set here), then lands in the app.
  const handleFocusGoalComplete = (mins: number) => {
    const { avatar, examTypes, customExam, name, email, futureGoal } = draftRef.current;
    finishOnboarding({
      name, email, examTypes, customExam, avatar, futureGoal: futureGoal ?? null,
      createdAt: new Date().toISOString(), dailyFocusGoalMins: mins,
    });
  };

  const finishOnboarding = (user: UserProfile) => {
    // Defensive, same as logout's clearing — local storage isn't namespaced
    // per-account, so without this a brand-new signup on a device someone
    // else (or a previous test account) used could silently inherit a
    // leftover in-progress focus session and have it "auto-complete" the
    // moment the app opens, logging time the new account never spent focusing.
    void clearActiveSession();
    void saveFocusLog([]);
    void saveDistractionLog([]);

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
          userIdRef.current = await withTimeout(ensureSession(), 6000, null);
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
    setScreen('walkthrough');
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
        new Promise<typeof TIMED_OUT>(resolve => setTimeout(() => resolve(TIMED_OUT), 8000)),
      ]);
      const user = result === TIMED_OUT ? null : result.data.user;
      userIdRef.current = user?.id ?? userIdRef.current;
    }

    if (hasProfile && userIdRef.current) {
      // Bounded the same way as the boot-time load — without this, a
      // slow/cold connection left the screen stuck on whatever it was
      // showing (createAccount, mid Google sign-in) with no error and no
      // way forward, since nothing here ever timed out on its own.
      const loaded = await withTimeout(loadUserFromSupabase(userIdRef.current), 8000, null);
      if (loaded) {
        // Same cross-account leak finishOnboarding already guards against
        // (local storage isn't namespaced per-account) — but that only
        // covers the fresh-signup path. Logging into an *existing* account
        // (this path, including Google) skipped it entirely: if a previous
        // account on this device left a focus session running when the app
        // got killed, its stale descriptor would still be sitting in
        // AsyncStorage, and the next time this newly-logged-in account
        // opened the Focus tab, FocusScreen would find that leftover
        // session past its planned end time and log its *full* duration as
        // a session this account never ran.
        void clearActiveSession();
        setAppState(loaded);
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
              <ActivityIndicator color={Colors.pop} size="small" />
            </View>
          )}
          {screen === 'walkthrough' && (
            <WalkthroughScreen onDone={handleWalkthroughDone} />
          )}
          {screen === 'avatarExam' && (
            <AvatarExamScreen
              onComplete={handleAvatarExamComplete}
              onLogin={handleLoginShortcut}
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
          }}
        />
      )}
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
