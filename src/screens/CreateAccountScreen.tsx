import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useHaptics } from '../hooks/useHaptics';

type Mode = 'signup' | 'login';

interface Props {
  /** Signed up (or upgraded the anonymous session) with a username to attach. */
  onSignedUp: (data: { name: string; email: string }) => void;
  /** Stayed anonymous, but still picked a username. */
  onGuest: (data: { name: string }) => void;
  /** Logged into an existing account — hasProfile tells the caller whether
   *  to skip the rest of onboarding (avatar/goal already set) or not. */
  onLoggedIn: (hasProfile: boolean) => void;
  onBack?: () => void;
  initialMode?: Mode;
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

// Screen 3 of onboarding — username + email/password (or stay anonymous),
// plus a placeholder for Google sign-in until that's wired up for real.
export const CreateAccountScreen: React.FC<Props> = ({ onSignedUp, onGuest, onLoggedIn, onBack, initialMode = 'signup' }) => {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { buttonPress } = useHaptics();

  const usernameOk = username.trim().length >= 2;
  const canSubmit = !loading && (mode === 'login'
    ? email.trim().length > 3 && password.length >= 6
    : usernameOk && email.trim().length > 3 && password.length >= 6);
  const canContinueGuest = mode === 'signup' && usernameOk && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await buttonPress();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data: { user: current } } = await supabase.auth.getUser();
        if (current?.is_anonymous) {
          const { error: upgradeErr } = await supabase.auth.updateUser({ email: email.trim(), password });
          if (upgradeErr) throw upgradeErr;
        } else {
          const { error: signUpErr } = await supabase.auth.signUp({ email: email.trim(), password });
          if (signUpErr) throw signUpErr;
        }
        onSignedUp({ name: username.trim(), email: email.trim() });
      } else {
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginErr) throw loginErr;
        onLoggedIn(true);
      }
    } catch (err: any) {
      setError(friendlyError(err?.message ?? 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    if (!canContinueGuest) return;
    await buttonPress();
    onGuest({ name: username.trim() });
  };

  const handleGoogle = () => {
    buttonPress();
    Alert.alert('Coming soon', 'Sign in with Google isn’t wired up yet — use email for now.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="light" />
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}

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
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
            />
          )}
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

          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} activeOpacity={0.85}>
            <Ionicons name="logo-google" size={18} color={Colors.textPrimary} />
            <Text style={styles.googleText}>Sign in with Google</Text>
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

        {mode === 'signup' && (
          <TouchableOpacity onPress={handleGuest} disabled={!canContinueGuest} style={styles.guestRow}>
            <Text style={[styles.guestText, !canContinueGuest && { opacity: 0.4 }]}>Continue as guest</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.xl, justifyContent: 'center', gap: Spacing.xl },
  backBtn: { position: 'absolute', top: 58, left: Spacing.xl },
  backText: { fontSize: 15, color: Colors.textSecondary, fontFamily: Fonts.medium },
  header: { gap: Spacing.xs, marginBottom: Spacing.md },
  wordmark: {
    fontFamily: Fonts.pixel, fontSize: 18, color: Colors.gray[400],
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: Spacing.sm,
  },
  title: { fontSize: 26, fontFamily: Fonts.bold, color: Colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, fontFamily: Fonts.regular },

  form: { gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: Fonts.regular,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  error: { color: Colors.danger, fontSize: 13, fontFamily: Fonts.regular },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.background },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  googleText: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textPrimary },

  switchRow: { alignItems: 'center' },
  switchText: { fontSize: 14, color: Colors.textSecondary, fontFamily: Fonts.regular },
  switchLink: { color: Colors.primary, fontFamily: Fonts.semibold },

  guestRow: { alignItems: 'center', paddingTop: Spacing.md },
  guestText: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline', fontFamily: Fonts.regular },
});
