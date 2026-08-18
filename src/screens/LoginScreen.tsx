import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useHaptics } from '../hooks/useHaptics';

type Mode = 'signup' | 'login';

interface Props {
  /** Called after a successful sign-up or log-in, with whether a profile already exists in Supabase. */
  onAuthed: (hasProfile: boolean) => void;
  onGuest: () => void;
}

function friendlyError(message: string): string {
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'That email is already registered — try logging in instead.';
  }
  if (message.includes('Invalid login credentials')) {
    return 'Wrong email or password.';
  }
  if (message.includes('Password should be at least')) {
    return 'Password needs at least 6 characters.';
  }
  return message;
}

export const LoginScreen: React.FC<Props> = ({ onAuthed, onGuest }) => {
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { buttonPress } = useHaptics();

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await buttonPress();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        // Upgrade the existing anonymous session (created automatically on
        // first launch) to a real account instead of creating a brand-new
        // user — this keeps the same id, so any local/anonymous progress
        // carries over rather than getting orphaned.
        const { data: { user: current } } = await supabase.auth.getUser();
        if (current?.is_anonymous) {
          const { error: upgradeErr } = await supabase.auth.updateUser({ email: email.trim(), password });
          if (upgradeErr) throw upgradeErr;
        } else {
          const { error: signUpErr } = await supabase.auth.signUp({ email: email.trim(), password });
          if (signUpErr) throw signUpErr;
        }
        onAuthed(false);
      } else {
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginErr) throw loginErr;
        onAuthed(true);
      }
    } catch (err: any) {
      setError(friendlyError(err?.message ?? 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.header}>
          <Text style={styles.wordmark}>There is no tomorrow</Text>
          <Text style={styles.title}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.sub}>
            {mode === 'signup'
              ? 'Your progress, streaks, and rank stay with you — sign up to keep them safe.'
              : 'Log in to pick up where you left off.'}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signup' ? 'new-password' : 'password'}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.submitText}>{mode === 'signup' ? 'Sign Up' : 'Log In'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => { buttonPress(); setError(''); setMode(mode === 'signup' ? 'login' : 'signup'); }}
          style={styles.switchRow}
        >
          <Text style={styles.switchText}>
            {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={styles.switchLink}>{mode === 'signup' ? 'Log in' : 'Sign up'}</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { buttonPress(); onGuest(); }} style={styles.guestRow}>
          <Text style={styles.guestText}>Continue as guest</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.xl, justifyContent: 'center', gap: Spacing.xl },
  header: { gap: Spacing.xs, marginBottom: Spacing.md },
  wordmark: {
    fontFamily: Fonts.display, fontSize: 13, color: Colors.blue[400],
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: Spacing.sm,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  form: { gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  error: { color: Colors.danger, fontSize: 13 },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 16, fontWeight: '700', color: Colors.background },

  switchRow: { alignItems: 'center' },
  switchText: { fontSize: 14, color: Colors.textSecondary },
  switchLink: { color: Colors.blue[400], fontWeight: '600' },

  guestRow: { alignItems: 'center', paddingTop: Spacing.md },
  guestText: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' },
});
