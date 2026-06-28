import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { storage } from './src/utils/storage';
import { UserProfile } from './src/types';
import OnboardingScreen from './src/screens/OnboardingScreen';

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
        {appState === 'main' && (
          <View style={{ flex: 1, backgroundColor: '#080810', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 64 }}>{profile?.avatar ?? '⭐'}</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 16 }}>
              Hey, {profile?.name ?? 'there'}!
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 8 }}>
              Home screen coming next
            </Text>
            <TouchableOpacity
              onPress={async () => { await storage.clearAll(); setProfile(null); setAppState('onboarding'); }}
              style={{ marginTop: 40, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Reset onboarding (dev)</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
