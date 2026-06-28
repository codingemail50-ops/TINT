import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { storage } from './src/utils/storage';
import { UserProfile } from './src/types';
import OnboardingScreen from './src/screens/OnboardingScreen';
import TabNavigator from './src/navigation/TabNavigator';
import AnimatedSplash from './src/components/AnimatedSplash';
import { requestNotificationPermission, scheduleDailyReminder } from './src/utils/notifications';

type AppState = 'splash' | 'loading' | 'onboarding' | 'main';

export default function App() {
  const [appState, setAppState] = useState<AppState>('splash');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  async function init() {
    const onboarded = await storage.getOnboarded();
    if (onboarded) {
      const p = await storage.getProfile();
      setProfile(p);
      setAppState('main');
      // Set up notifications silently
      requestNotificationPermission().then(granted => {
        if (granted) scheduleDailyReminder();
      });
    } else {
      setAppState('onboarding');
    }
  }

  if (appState === 'loading') {
    return <View style={{ flex: 1, backgroundColor: '#080810' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {appState === 'onboarding' && (
          <OnboardingScreen
            onDone={(p) => {
              setProfile(p);
              setAppState('main');
              requestNotificationPermission().then(granted => {
                if (granted) scheduleDailyReminder();
              });
            }}
          />
        )}
        {appState === 'main' && profile && (
          <TabNavigator profile={profile} onProfileReset={() => setAppState('onboarding')} />
        )}
        {appState === 'splash' && (
          <AnimatedSplash onDone={init} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
