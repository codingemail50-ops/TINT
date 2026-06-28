import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserProfile } from '../types';
import { storage } from '../utils/storage';

const AVATARS = ['⭐', '🔥', '🎯', '💎', '🚀', '🦁', '🐯', '🦊', '🐺', '🦅', '🌙', '⚡'];

interface Props {
  profile: UserProfile;
  onReset: () => void;
}

export default function ProfileScreen({ profile, onReset }: Props) {
  const [avatar, setAvatar] = useState(profile.avatar);
  const [saved, setSaved] = useState(false);

  async function saveAvatar(a: string) {
    setAvatar(a);
    const updated = { ...profile, avatar: a };
    await storage.setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function confirmReset() {
    Alert.alert(
      'Reset everything?',
      'This will clear all your tasks, history, and profile. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await storage.clearAll();
            onReset();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.pageTitle}>Profile</Text>

        {/* Avatar display */}
        <View style={s.avatarWrap}>
          <Text style={s.avatarBig}>{avatar}</Text>
          <Text style={s.nameText}>{profile.name}</Text>
          <Text style={s.emailText}>{profile.email}</Text>
        </View>

        {/* Exams */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your exams</Text>
          <View style={s.examRow}>
            {profile.exams.map(e => (
              <View key={e} style={s.examChip}>
                <Text style={s.examChipText}>{e}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Change avatar */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Change avatar</Text>
          <View style={s.avatarGrid}>
            {AVATARS.map(a => (
              <TouchableOpacity
                key={a}
                style={[s.avatarBtn, avatar === a && s.avatarSelected]}
                onPress={() => saveAvatar(a)}
              >
                <Text style={s.avatarEmoji}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {saved && <Text style={s.savedText}>✓ Saved</Text>}
        </View>

        {/* Reset */}
        <View style={s.section}>
          <TouchableOpacity style={s.resetBtn} onPress={confirmReset}>
            <Text style={s.resetText}>Reset all data</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080810' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  pageTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 24 },

  avatarWrap: { alignItems: 'center', marginBottom: 32 },
  avatarBig: { fontSize: 80, marginBottom: 12 },
  nameText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  emailText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 4 },

  section: { marginBottom: 28 },
  sectionTitle: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },

  examRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  examChip: { backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  examChipText: { color: '#818CF8', fontSize: 14, fontWeight: '600' },

  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarBtn: { width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarSelected: { borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.15)' },
  avatarEmoji: { fontSize: 28 },
  savedText: { color: '#22C55E', fontSize: 13, marginTop: 12, textAlign: 'center' },

  resetBtn: { backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)' },
  resetText: { color: '#F87171', fontSize: 15, fontWeight: '600' },
});
