import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useHaptics } from '../hooks/useHaptics';
import { AvatarWall } from '../components/AvatarWall';
import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from '../utils/googleAuth';

// Public (non-secret) Web OAuth client id from Google Cloud Console — see
// PRIORITY 2 in the EAS audit for the full Google Cloud/Supabase setup this
// depends on. Only the client *secret* is sensitive, and that lives in
// Supabase's dashboard, never here.
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

type Mode = 'signup' | 'login';

interface Props {
  /** Signed up (or upgraded the anonymous session) with a username to attach. */
  onSignedUp: (data: { name: string; email: string }) => void;
  /** Stayed anonymous, but still picked a username. */
  onGuest: (data: { name: string }) => void;
  /** Logged into an existing account — hasProfile tells the caller whether
   *  to skip the rest of onboarding (avatar/goal already set) or not. */
  onLoggedIn: (hasProfile: boolean, userId?: string) => void;
  onBack?: () => void;
  initialMode?: Mode;
  /** The avatar picked on step 1 — tiled as a scrolling brick-pattern
   *  background, rows alternating direction. Omitted for the direct-login
   *  shortcut, which skips step 1. */
  avatar?: string;
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
  if (message.includes('Failed to fetch') || message.includes('Network request failed')) {
    return 'No internet connection — check your network and try again.';
  }
  return message;
}

// Screen 3 of onboarding — username + email/password, Google Sign-In, or
// stay anonymous. Google Sign-In only functions on a native Android build
// (see ../utils/googleAuth.ts) — Expo Go/web show a clear "not available" alert instead.
export const CreateAccountScreen: React.FC<Props> = ({ onSignedUp, onGuest, onLoggedIn, onBack, initialMode = 'signup', avatar }) => {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { buttonPress } = useHaptics();

  useEffect(() => {
    if (GoogleSignin && GOOGLE_WEB_CLIENT_ID) {
      // Safe to call repeatedly / on every mount — configure() just sets
      // options for later calls, it doesn't itself touch the network.
      try {
        GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
      } catch {
        // Shouldn't happen given the guard above, but fail quiet either way —
        // handleGoogle below hits the same wall and reports it there.
      }
    }
  }, []);

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
        const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginErr) throw loginErr;
        onLoggedIn(true, loginData.user?.id);
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

  const handleGoogle = async () => {
    await buttonPress();

    if (!GoogleSignin || !GOOGLE_WEB_CLIENT_ID) {
      Alert.alert(
        'Not available in this build',
        !GoogleSignin
          ? 'Google Sign-In needs a full Android build (not Expo Go or the web preview) to work.'
          : 'Google Sign-In isn’t configured yet — it needs a Google Cloud OAuth client id for this build.'
      );
      return;
    }

    setError('');
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse?.(response)) {
        // User backed out of the Google account picker — not an error.
        return;
      }
      const idToken = response.data.idToken;
      if (!idToken) throw new Error('Google did not return an ID token.');

      const { data, error: supaError } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (supaError) throw supaError;

      // Whatever's sitting in the TINT-account fields above (even
      // half-typed) is irrelevant to a Google sign-in that just completed —
      // clearing it before navigating away stops Android's autofill save
      // prompt from offering to save those stale, unrelated values as if
      // they were the credential just used.
      setUsername('');
      setEmail('');
      setPassword('');

      // Same convention as the email/password login path: hasProfile=true,
      // and AppNavigator's existing fallback already routes a brand-new
      // user (no cloud profile row yet) into onboarding instead of crashing.
      onLoggedIn(true, data.user?.id);
    } catch (err: any) {
      const code = isErrorWithCode?.(err) ? err.code : null;
      if (code && statusCodes && code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled — no error banner needed.
      } else if (code && statusCodes && code === statusCodes.IN_PROGRESS) {
        setError('A sign-in is already in progress.');
      } else if (code && statusCodes && code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services isn’t available on this device.');
      } else {
        setError(friendlyError(err?.message ?? 'Google sign-in failed.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="light" />
        {/* Tiled the whole screen height on purpose (not just a header band) —
            the wall stays faintly visible above AND below the form instead
            of fading to solid black by the bottom. */}
        {!!avatar && <AvatarWall icons={[avatar]} alternateDirection rows={20} cellSize={52} angleDeg={-8} durationMs={22000} />}
        <LinearGradient
          colors={['rgba(6,6,8,0.45)', 'rgba(6,6,8,0.75)', 'rgba(6,6,8,0.75)', 'rgba(6,6,8,0.45)']}
          locations={[0, 0.35, 0.75, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
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
          {/* A TINT username/password is a separate credential from
              Google's — several testers assumed these fields were somehow
              tied to their Gmail password. Labeling this group explicitly
              and visually separating it from the Google option below (a
              divider + its own caption) is meant to head that off. */}
          <Text style={styles.groupLabel}>{mode === 'signup' ? 'Create a TINT account' : 'Log in with your TINT account'}</Text>
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              autoComplete="username"
              textContentType="username"
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
            textContentType="emailAddress"
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
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
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

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} activeOpacity={0.85}>
            <Ionicons name="logo-google" size={18} color={Colors.textPrimary} />
            <Text style={styles.googleText}>Sign in with Google</Text>
          </TouchableOpacity>
          <Text style={styles.googleCaption}>Uses your Google account directly — no separate username or password needed.</Text>
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
  groupLabel: {
    fontSize: 12, fontFamily: Fonts.semibold, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2,
  },
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

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.sm, marginBottom: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  googleText: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.textPrimary },
  googleCaption: {
    fontSize: 11.5, color: Colors.textMuted, fontFamily: Fonts.regular,
    textAlign: 'center', marginTop: 4,
  },

  switchRow: { alignItems: 'center' },
  switchText: { fontSize: 14, color: Colors.textSecondary, fontFamily: Fonts.regular },
  switchLink: { color: Colors.primary, fontFamily: Fonts.semibold },

  guestRow: { alignItems: 'center', paddingTop: Spacing.md },
  guestText: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline', fontFamily: Fonts.regular },
});
