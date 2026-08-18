import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { TodoScreen } from '../screens/TodoScreen';
import { FocusScreen } from '../screens/FocusScreen';
import { ProductivityScreen } from '../screens/ProductivityScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { StorageService, AppState } from '../utils/storage';
import { supabase } from '../lib/supabase';
import {
  loadUserFromSupabase,
  syncAppStateToSupabase,
  saveNewUserToSupabase,
  checkUserExists,
} from '../utils/supabaseStorage';

// Every device still gets an anonymous Supabase session created behind the
// scenes on first launch — LoginScreen's "Sign Up" upgrades that same
// session to a real account (same user id) rather than discarding it, so a
// guest who later signs up doesn't lose anything already saved locally.
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

type Screen = 'boot' | 'login' | 'onboarding' | 'todo' | 'focus' | 'productivity' | 'leaderboard';

const TAB_CONFIG = [
  { id: 'todo' as Screen, label: 'Today', icon: 'checkbox' as const },
  { id: 'focus' as Screen, label: 'Focus', icon: 'flash' as const },
  { id: 'productivity' as Screen, label: 'Progress', icon: 'stats-chart' as const },
  { id: 'leaderboard' as Screen, label: 'Rank', icon: 'trophy' as const },
];

export const AppNavigator: React.FC = () => {
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
  const tabFadeAnim = useRef(new Animated.Value(0)).current;
  const userIdRef = useRef<string | null>(null);

  // No splash animation — resolve session/local state directly on mount.
  useEffect(() => {
    void (async () => {
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
        setScreen('onboarding');
      }
    })();
  }, []);

  const handleOnboardingComplete = () => {
    StorageService.getAppState().then(async state => {
      setAppState(state);
      setShowTabs(true);
      setScreen('todo');
      Animated.timing(tabFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

      if (!userIdRef.current) {
        userIdRef.current = await ensureSession();
      }
      if (userIdRef.current && state.user) {
        void saveNewUserToSupabase(userIdRef.current, '', state.user);
      }
    });
  };

  const handleStateChange = (newState: AppState) => {
    StorageService.saveAppState(newState);
    setAppState(newState);
    if (userIdRef.current) {
      void syncAppStateToSupabase(userIdRef.current, newState);
    }
  };

  const navigateTo = (s: Screen) => {
    setScreen(s);
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

  const swipeGesture = Gesture.Pan()
    .enabled(showTabs)
    .activeOffsetX([-25, 25])
    .failOffsetY([-20, 20])
    .onEnd(event => {
      'worklet';
      if (Math.abs(event.translationX) < 60) return;
      runOnJS(goRelative)(event.translationX < 0 ? 1 : -1);
    });

  return (
    <View style={styles.root}>
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.swipeArea}>
          {screen === 'onboarding' && <OnboardingScreen onComplete={handleOnboardingComplete} />}
          {screen === 'todo' && <TodoScreen appState={appState} onStateChange={handleStateChange} userId={userIdRef.current ?? undefined} />}
          {screen === 'focus' && <FocusScreen userId={userIdRef.current ?? undefined} />}
          {screen === 'productivity' && <ProductivityScreen appState={appState} />}
          {screen === 'leaderboard' && <LeaderboardScreen appState={appState} userId={userIdRef.current ?? undefined} />}
        </View>
      </GestureDetector>

      {showTabs && (
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
                    color={isActive ? Colors.primary : Colors.textMuted}
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
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 28,
    paddingTop: 12,
    paddingHorizontal: 16,
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
    borderRadius: 10,
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
