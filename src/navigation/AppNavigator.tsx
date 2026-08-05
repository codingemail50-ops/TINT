import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Colors, Typography } from '../constants/theme';
import { SplashScreen } from '../screens/SplashScreen';
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

// Every device gets an anonymous Supabase user behind the scenes — no login
// screen needed. Onboarding (name + exam) is the only "sign in" a user sees.
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

type Screen = 'splash' | 'onboarding' | 'todo' | 'focus' | 'productivity' | 'leaderboard';

const TAB_CONFIG = [
  { id: 'todo' as Screen, label: 'Today', icon: '📋' },
  { id: 'focus' as Screen, label: 'Focus', icon: '⚡' },
  { id: 'productivity' as Screen, label: 'Progress', icon: '📊' },
  { id: 'leaderboard' as Screen, label: 'Rank', icon: '🏆' },
];

export const AppNavigator: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('splash');
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

  const handleSplashFinish = (_hasUser: boolean) => {
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
  };

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

  return (
    <View style={styles.root}>
      {screen === 'splash' && <SplashScreen onFinish={handleSplashFinish} />}
      {screen === 'onboarding' && <OnboardingScreen onComplete={handleOnboardingComplete} />}
      {screen === 'todo' && <TodoScreen appState={appState} onStateChange={handleStateChange} userId={userIdRef.current ?? undefined} />}
      {screen === 'focus' && <FocusScreen userId={userIdRef.current ?? undefined} />}
      {screen === 'productivity' && <ProductivityScreen appState={appState} />}
      {screen === 'leaderboard' && <LeaderboardScreen appState={appState} userId={userIdRef.current ?? undefined} />}

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
                  <Text style={styles.tabIcon}>{tab.icon}</Text>
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
  tabIcon: {
    fontSize: 20,
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
