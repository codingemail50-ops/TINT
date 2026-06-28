import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { storage } from './src/utils/storage';
import { UserProfile } from './src/types';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';

type AppState = 'loading' | 'onboarding' | 'main';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    (async () => {
      const onboarded = await storage.getOnboarded();
      if (onboarded) {
        const p = await storage.getProfile();
        setProfile(p);
        setAppState('main');
      } else {
        setAppState('onboarding');
      }
    })();
  }, []);

  if (appState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#080810', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {appState === 'onboarding' && (
          <OnboardingScreen
            onDone={(p) => {
              setProfile(p);
              setAppState('main');
            }}
          />
        )}
        {appState === 'main' && profile && (
          <HomeScreen profile={profile} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
