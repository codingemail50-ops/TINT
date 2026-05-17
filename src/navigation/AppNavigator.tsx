import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Colors, Typography } from '../constants/theme';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { TodoScreen } from '../screens/TodoScreen';
import { ProductivityScreen } from '../screens/ProductivityScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { StorageService, AppState } from '../utils/storage';

type Screen = 'splash' | 'onboarding' | 'todo' | 'productivity' | 'leaderboard';

const TAB_CONFIG = [
  { id: 'todo' as Screen, label: 'Today', icon: '📋' },
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
  const tabFadeAnim = React.useRef(new Animated.Value(0)).current;

  const loadState = async () => {
    const state = await StorageService.getAppState();
    setAppState(state);
  };

  const handleSplashFinish = (hasUser: boolean) => {
    loadState().then(() => {
      setScreen(hasUser ? 'todo' : 'onboarding');
      if (hasUser) {
        Animated.timing(tabFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }
    });
  };

  const handleOnboardingComplete = () => {
    loadState().then(() => {
      setScreen('todo');
      Animated.timing(tabFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });
  };

  const handleStateChange = (newState: AppState) => {
    setAppState(newState);
  };

  const navigateTo = (s: Screen) => {
    setScreen(s);
  };

  const showTabs = screen !== 'splash' && screen !== 'onboarding';

  return (
    <View style={styles.root}>
      {screen === 'splash' && <SplashScreen onFinish={handleSplashFinish} />}
      {screen === 'onboarding' && <OnboardingScreen onComplete={handleOnboardingComplete} />}
      {screen === 'todo' && <TodoScreen appState={appState} onStateChange={handleStateChange} />}
      {screen === 'productivity' && <ProductivityScreen appState={appState} />}
      {screen === 'leaderboard' && <LeaderboardScreen appState={appState} />}

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
