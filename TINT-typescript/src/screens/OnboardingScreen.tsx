import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExamType, UserProfile } from '../types';
import { generateTasksForExams } from '../data/examPresets';
import { storage } from '../utils/storage';
import { syncToCloud } from '../utils/supabase';

const { width } = Dimensions.get('window');

const AVATARS = ['⭐', '🔥', '🎯', '💎', '🚀', '🦁', '🐯', '🦊', '🐺', '🦅', '🌙', '⚡'];
const EXAMS: { id: ExamType; label: string; emoji: string; date: string }[] = [
  { id: 'UCEED', label: 'UCEED', emoji: '🎨', date: 'Jan 2027' },
  { id: 'NID', label: 'NID', emoji: '✏️', date: 'Dec 2026' },
  { id: 'NIFT', label: 'NIFT', emoji: '👗', date: 'Feb 2027' },
  { id: 'JEE', label: 'JEE', emoji: '📐', date: 'Apr 2027' },
];

type Step = 'avatar' | 'name' | 'exams' | 'email';

interface Props {
  onDone: (profile: UserProfile) => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState<Step>('avatar');
  const [avatar, setAvatar] = useState('⭐');
  const [name, setName] = useState('');
  const [exams, setExams] = useState<ExamType[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps: Step[] = ['avatar', 'name', 'exams', 'email'];
  const stepIndex = steps.indexOf(step);
  const progress = (stepIndex + 1) / steps.length;

  function toggleExam(id: ExamType) {
    setExams(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  }

  function nextStep() {
    setError('');
    if (step === 'avatar') setStep('name');
    else if (step === 'name') {
      if (!name.trim()) { setError('Please enter your name'); return; }
      setStep('exams');
    }
    else if (step === 'exams') {
      if (exams.length === 0) { setError('Select at least one exam'); return; }
      setStep('email');
    }
  }

  async function finish() {
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    setLoading(true);
    const profile: UserProfile = { name: name.trim(), avatar, email: email.trim().toLowerCase(), exams };
    const tasks = generateTasksForExams(exams);
    await storage.setProfile(profile);
    await storage.setTasks(tasks);
    await storage.setOnboarded();
    await storage.setLastReset(new Date().toISOString().split('T')[0]);
    await syncToCloud(profile.email, profile, tasks, [], []);
    setLoading(false);
    onDone(profile);
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* STEP 1 — Avatar */}
          {step === 'avatar' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>Pick your avatar</Text>
              <Text style={s.sub}>This represents you on the leaderboard</Text>
              <View style={s.avatarGrid}>
                {AVATARS.map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[s.avatarBtn, avatar === a && s.avatarSelected]}
                    onPress={() => setAvatar(a)}
                  >
                    <Text style={s.avatarEmoji}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* STEP 2 — Name */}
          {step === 'name' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>What's your name?</Text>
              <Text style={s.sub}>This is how you'll appear to others</Text>
              <View style={s.previewWrap}>
                <Text style={s.previewAvatar}>{avatar}</Text>
                <TextInput
                  style={s.nameInput}
                  placeholder="Your name"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={nextStep}
                />
              </View>
            </View>
          )}

          {/* STEP 3 — Exams */}
          {step === 'exams' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>Which exams are{'\n'}you preparing for?</Text>
              <Text style={s.sub}>Select all that apply</Text>
              <View style={s.examGrid}>
                {EXAMS.map(ex => {
                  const selected = exams.includes(ex.id);
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      style={[s.examCard, selected && s.examSelected]}
                      onPress={() => toggleExam(ex.id)}
                    >
                      <Text style={s.examEmoji}>{ex.emoji}</Text>
                      <Text style={[s.examLabel, selected && s.examLabelSelected]}>{ex.label}</Text>
                      <Text style={s.examDate}>{ex.date}</Text>
                      {selected && <View style={s.examCheck}><Text style={s.examCheckText}>✓</Text></View>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* STEP 4 — Email */}
          {step === 'email' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>Your email</Text>
              <Text style={s.sub}>Used to sync your progress across devices</Text>
              <TextInput
                style={s.emailInput}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={email}
                onChangeText={setEmail}
                autoFocus
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={finish}
              />
            </View>
          )}

          {/* Error */}
          {error ? <Text style={s.error}>{error}</Text> : null}

          {/* Button */}
          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={step === 'email' ? finish : nextStep}
            disabled={loading}
          >
            <Text style={s.btnText}>
              {loading ? 'Setting up...' : step === 'email' ? "Let's go →" : 'Continue →'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080810' },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 24, marginTop: 12, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: '#6366F1', borderRadius: 2 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40 },
  stepWrap: { flex: 1, marginBottom: 32 },
  heading: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 8, lineHeight: 40 },
  sub: { fontSize: 15, color: 'rgba(255,255,255,0.4)', marginBottom: 40 },

  // Avatar
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  avatarBtn: { width: (width - 48 - 36) / 4, aspectRatio: 1, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarSelected: { borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.15)' },
  avatarEmoji: { fontSize: 32 },

  // Name
  previewWrap: { alignItems: 'center', gap: 20 },
  previewAvatar: { fontSize: 72 },
  nameInput: { width: '100%', fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center', borderBottomWidth: 2, borderBottomColor: 'rgba(99,102,241,0.5)', paddingBottom: 12, letterSpacing: 0.5 },

  // Exams
  examGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  examCard: { width: (width - 48 - 12) / 2, padding: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 2, borderColor: 'transparent' },
  examSelected: { borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.12)' },
  examEmoji: { fontSize: 32, marginBottom: 8 },
  examLabel: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  examLabelSelected: { color: '#fff' },
  examDate: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  examCheck: { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' },
  examCheckText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Email
  emailInput: { fontSize: 18, color: '#fff', borderBottomWidth: 2, borderBottomColor: 'rgba(99,102,241,0.5)', paddingBottom: 12 },

  // Button
  btn: { backgroundColor: '#6366F1', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },

  // Error
  error: { color: '#F87171', fontSize: 14, textAlign: 'center', marginBottom: 16 },
});
