import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '../constants/theme';
import { AvatarExamScreen } from '../screens/AvatarExamScreen';
import { FocusGoalScreen } from '../screens/FocusGoalScreen';
import { CreateAccountScreen } from '../screens/CreateAccountScreen';
import { TodoScreen } from '../screens/TodoScreen';
import { FocusScreen } from '../screens/FocusScreen';
import { ProductivityScreen } from '../screens/ProductivityScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { StorageService, AppState, UserProfile } from '../utils/storage';
import { ExamType, CustomExam } from '../data/examPresets';
import { supabase } from '../lib/supabase';
import { FocusSessionProvider, useFocusSessionStatus } from '../context/FocusSessionContext';
import { FocusMiniPlayer } from '../components/FocusMiniPlayer';
import { loadDevOffset, subscribeDevClock } from '../utils/devClock';
import {
  loadUserFromSupabase,
  syncAppStateToSupabase,
  saveNewUserToSupabase,
  checkUserExists,
} from '../utils/supabaseStorage';

// Every device still gets an anonymous Supabase session created behind the
// scenes on first launch — signing up upgrades that same session to a real
// account (same user id) rather than discarding it, so a guest who later
// signs up doesn't lose anything already saved locally.
async function ensureSession(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session.user.id;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('[AppNavigator] Anonymous sign-in failed:', error.message);
      return null;
    }
    return data.session?.user.id ?? null;
  } catch (err) {
    console.error('[AppNavigator] ensureSession exception:', err);
    return null;
  }
}

type Screen =
  | 'boot' | 'avatarExam' | 'focusGoal' | 'createAccount'
  | 'todo' | 'focus' | 'productivity' | 'leaderboard' | 'profile';

const TAB_CONFIG = [
  { id: 'todo' as Screen, label: 'Today', icon: 'checkbox' as const },
  { id: 'focus' as Screen, label: 'Focus', icon: 'flash' as const },
  { id: 'productivity' as Screen, label: 'Progress', icon: 'stats-chart' as const },
  { id: 'leaderboard' as Screen, label: 'Rank', icon: 'trophy' as const },
];

// showTabs stays true for the rest of the session once a profile exists, but
// the bottom tab bar must not paint over onboarding screens reached via the
// Home wordmark's replay shortcut — it used to swallow taps meant for those
// screens' own buttons.
const ONBOARDING_SCREENS = new Set<Screen>(['avatarExam', 'focusGoal', 'createAccount']);

interface OnboardingDraft {
  avatar: string;
  examTypes: ExamType[];
  customExam?: CustomExam;
  dailyFocusGoalMins: number;
  name: string;
  email: string;
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
  // Tapping the wordmark on Home replays the full onboarding flow from step
  // 1, exactly as a first-time user would see it (temporary dev shortcut,
  // to be removed later) — this flag is what gives step 1 a working back
  // button (real first launches have nowhere to go back to, so it's absent
  // there) that returns to Today instead of leaving them stranded.
  const [previewFromHome, setPreviewFromHome] = useState(false);
  const tabFadeAnim = useRef(new Animated.Value(0)).current;
  const userIdRef = useRef<string | null>(null);
  const { status: focusStatus } = useFocusSessionStatus();
  const draftRef = useRef<OnboardingDraft>({ avatar: 'star', examTypes: [], dailyFocusGoalMins: 60, name: '', email: '' });

  // No splash animation — resolve session/local state directly on mount.
  useEffect(() => {
    void (async () => {
      // Must resolve before anything below reads "today" — otherwise a
      // saved dev day-skip offset wouldn't apply until the next reload.
      await loadDevOffset();
      const userId = await ensureSession();
      userIdRef.current = userId;

      if (userId) {
        const exists = await checkUserExists(userId);
        if (exists) {
          const loaded = await loadUserFromSupabase(userId);
          if (loaded) {
            setAppState(loaded);
            setShowTabs(true);
            setScreen('todo');
            Animated.timing(tabFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
            return;
          }
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
      } else {
        setScreen('avatarExam');
      }
    })();
  }, []);

  // Tab screens stay mounted now, so the dev-mode day-skip tool needs an
  // explicit nudge to refresh appState (streak/history are date-dependent) —
  // nothing else would trigger a refetch once past the initial boot.
  useEffect(() => subscribeDevClock(() => {
    void StorageService.getAppState().then(setAppState);
  }), []);

  const navigateTo = (s: Screen) => setScreen(s);

  // ── Onboarding flow: avatarExam -> createAccount -> focusGoal ────────────
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

  const handleOpenOnboardingPreview = () => {
    setPreviewFromHome(true);
    setScreen('avatarExam');
  };

  // Tail of onboarding — persists the full profile (avatar/exams from step 1
  // + name/email from step 2 + the goal just set here), then boots into the
  // app the same way a returning user does.
  const handleFocusGoalComplete = (mins: number) => {
    draftRef.current.dailyFocusGoalMins = mins;
    const { avatar, examTypes, customExam, name, email } = draftRef.current;
    finishOnboarding({ name, email, examTypes, customExam, avatar, createdAt: new Date().toISOString(), dailyFocusGoalMins: mins });
  };

  const finishOnboarding = (user: UserProfile) => {
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
          userIdRef.current = await ensureSession();
        }
        if (userIdRef.current && state.user) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          void saveNewUserToSupabase(userIdRef.current, authUser?.email ?? '', state.user);
        }
      });
  };

  const handleSignedUp = ({ name, email }: { name: string; email: string }) => {
    draftRef.current.name = name;
    draftRef.current.email = email;
    setScreen('focusGoal');
  };

  const handleGuestNamed = ({ name }: { name: string }) => {
    draftRef.current.name = name;
    draftRef.current.email = '';
    setScreen('focusGoal');
  };

  const handleLoggedIn = async (hasProfile: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    userIdRef.current = user?.id ?? userIdRef.current;

    if (hasProfile && userIdRef.current) {
      const loaded = await loadUserFromSupabase(userIdRef.current);
      if (loaded) {
        setAppState(loaded);
        setShowTabs(true);
        setScreen('todo');
        Animated.timing(tabFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        return;
      }
    }
    // Logged in but no cloud profile row yet — run through onboarding to collect one.
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
  // standalone session, Today's task-linked overlay for a task session).
  const focusUIOnScreen = (focusStatus.source === 'tab' && screen === 'focus')
    || (focusStatus.source === 'task' && screen === 'todo');
  const miniPlayerVisible = focusStatus.active && !focusUIOnScreen;

  const handleMiniPlayerPress = () => {
    navigateTo(focusStatus.source === 'task' ? 'todo' : 'focus');
  };

  return (
    <View style={styles.root}>
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.swipeArea}>
          {screen === 'avatarExam' && (
            <AvatarExamScreen
              onComplete={handleAvatarExamComplete}
              onLogin={handleLoginShortcut}
              onBack={previewFromHome ? () => { setPreviewFromHome(false); setScreen('todo'); } : undefined}
            />
          )}
          {screen === 'createAccount' && (
            <CreateAccountScreen
              onSignedUp={handleSignedUp}
              onGuest={handleGuestNamed}
              onLoggedIn={handleLoggedIn}
              onBack={loginShortcut ? undefined : () => setScreen('avatarExam')}
              initialMode={loginShortcut ? 'login' : 'signup'}
              avatar={draftRef.current.avatar}
            />
          )}
          {screen === 'focusGoal' && (
            <FocusGoalScreen onComplete={handleFocusGoalComplete} onBack={() => setScreen('createAccount')} />
          )}
          {/* Today and Focus stay mounted (visibility toggled via
              display:none) instead of being swapped in and out of the tree —
              otherwise navigating away destroys their state, which is
              exactly what was happening to a running Focus session the
              moment you switched tabs. Progress and Rank don't hold any
              timer/session state worth preserving, so they stay simple
              mount-on-visit — keeping four heavy screens (charts, podium,
              animations) alive simultaneously all the time was the likely
              cause of the app feeling sluggish. */}
          {showTabs && (
            <View style={[styles.tabScreenSlot, screen !== 'todo' && styles.hidden]}>
              <TodoScreen
                appState={appState}
                onStateChange={handleStateChange}
                userId={userIdRef.current ?? undefined}
                onNavigateFocus={() => navigateTo('focus')}
                onNavigateProfile={() => navigateTo('profile')}
                onNavigateAnalytics={() => navigateTo('productivity')}
                onPreviewOnboarding={handleOpenOnboardingPreview}
              />
            </View>
          )}
          {showTabs && (
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
