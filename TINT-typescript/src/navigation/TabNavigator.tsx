import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserProfile } from '../types';
import HomeScreen from '../screens/HomeScreen';
import FocusScreen from '../screens/FocusScreen';
import ProgressScreen from '../screens/ProgressScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

interface Props {
  profile: UserProfile;
  onProfileReset: () => void;
}

function icon(label: string, focused: boolean) {
  const icons: Record<string, [string, string]> = {
    Home:        ['🏠', '🏡'],
    Focus:       ['⏱️', '🎯'],
    Progress:    ['📊', '📈'],
    Leaderboard: ['🏆', '🥇'],
    Profile:     ['👤', '😊'],
  };
  const [off, on] = icons[label] ?? ['●', '●'];
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>{focused ? on : off}</Text>;
}

export default function TabNavigator({ profile, onProfileReset }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0E0E1A',
            borderTopColor: 'rgba(255,255,255,0.06)',
            borderTopWidth: 1,
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
          },
          tabBarActiveTintColor: '#6366F1',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        }}
      >
        <Tab.Screen
          name="Home"
          options={{ tabBarIcon: ({ focused }) => icon('Home', focused) }}
        >
          {() => <HomeScreen profile={profile} />}
        </Tab.Screen>
        <Tab.Screen
          name="Focus"
          options={{ tabBarIcon: ({ focused }) => icon('Focus', focused) }}
        >
          {() => <FocusScreen profile={profile} />}
        </Tab.Screen>
        <Tab.Screen
          name="Progress"
          options={{ tabBarIcon: ({ focused }) => icon('Progress', focused) }}
        >
          {() => <ProgressScreen profile={profile} />}
        </Tab.Screen>
        <Tab.Screen
          name="Leaderboard"
          options={{ tabBarIcon: ({ focused }) => icon('Leaderboard', focused) }}
        >
          {() => <LeaderboardScreen profile={profile} />}
        </Tab.Screen>
        <Tab.Screen
          name="Profile"
          options={{ tabBarIcon: ({ focused }) => icon('Profile', focused) }}
        >
          {() => <ProfileScreen profile={profile} onReset={onProfileReset} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
