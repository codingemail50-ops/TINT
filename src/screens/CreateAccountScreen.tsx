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
  onSignedUp: (data: { name: string; email: string; userId?: string }) => void;
  /** Logged into an existing account — hasProfile tells the caller whether
   *  to skip the rest of onboarding (avatar/goal already set) or not. */
  onLoggedIn: (hasProfile: boolean, userId?: string, googleEmail?: string) => void;
  onBack?: () => void;
  initialMode?: Mode;
  /** The avatar picked on step 1 — tiled as a scrolling brick-pattern
   *  background, rows alternating direction. Omitted for the direct-login
   *  shortcut, which skips step 1. */
  avatar?: string;
}

// Supabase's client has no built-in request timeout, and these auth calls
// are the one thing standing between tapping Sign Up/Log In and getting
// into the app — a slow/cold connection left them hanging with the button
// stuck on its loading spinner and no way to tell it wasn't ever going to
// resolve. Rejecting after `ms` turns that into a normal, retryable error.
const AUTH_TIMEOUT_MS = 15000;
function withTimeout<T>(promise: Promise<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out — check your connection and try again.')), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      err => { clearTimeout(timer); reject(err); },
    );
  });
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
export const CreateAccountScreen: React.FC<Props> = ({
  onSignedUp, onLoggedIn, onBack, initialMode = 'signup', avatar,
}) => {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
  const handleSubmit = async () => {
    if (!canSubmit) return;
    await buttonPress();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        // No anonymous-session upgrade path — this Supabase project has
        // "Allow anonymous sign-ins" turned off, so there's never an
        // existing anonymous session to upgrade. Every signup is a plain,
        // direct signUp() call.
        const { data: signUpData, error: signUpErr } = await withTimeout(supabase.auth.signUp({ email: email.trim(), password }));
        if (signUpErr) throw signUpErr;
        // If the Supabase project has "Confirm email" turned on, signUp()
        // creates the auth user but returns session: null until they click
        // the confirmation link — the client has no active session at all
        // afterward. Every request this app makes right after (starting
        // with writing this profile row) is then sent completely
        // unauthenticated, and Postgres RLS ("auth.uid() = id") silently
        // rejects it — no confirmation screen exists anywhere in this
        // app's onboarding, so that failure was invisible and looked
        // exactly like "signup succeeded, profile just never saved."
        if (!signUpData.session) {
          throw new Error(
            'Your account was created but needs email confirmation before you can continue — check your inbox, or turn off "Confirm email" in the Supabase project (Authentication → Sign In / Providers → Email) if that\'s not intended for this app.'
          );
        }
        const userId = signUpData.user?.id;
        // Passing this straight through means the profile row that finishes
        // onboarding writes to Supabase uses the id this exact signup call
        // just returned, instead of a separate ensureSession() call later
        // possibly failing independently and silently — which was leaving
        // some accounts authenticated but with no profile row at all, so
        // every future login found "nothing to load" and bounced back to
        // onboarding as if they'd never signed up.
        onSignedUp({ name: username.trim(), email: email.trim(), userId });
      } else {
        const { data: loginData, error: loginErr } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }));
        if (loginErr) throw loginErr;
        onLoggedIn(true, loginData.user?.id);
      }
    } catch (err: any) {
      setError(friendlyError(err?.message ?? 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
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
      // Google Play Services caches which account was used for this app
      // last time and, without this, silently reuses it on every future
      // signIn() call instead of showing the account picker at all — the
      // documented way to force the chooser back open is to sign out of
      // the native Google session immediately beforehand. This only clears
      // the cached *native* selection, not the actual TINT/Supabase
      // session, so it's safe to call unconditionally (including the very
      // first time, when there's nothing to sign out of).
      try { await GoogleSignin.signOut(); } catch {}
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse?.(response)) {
        // User backed out of the Google account picker — not an error.
        return;
      }
      const idToken = response.data.idToken;
      if (!idToken) throw new Error('Google did not return an ID token.');

      const { data, error: supaError } = await withTimeout(supabase.auth.signInWithIdToken({ provider: 'google', token: idToken }));
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
      // and AppNavigator's existing fallback routes a brand-new user (no
      // cloud profile row yet) into onboarding instead of crashing.
      onLoggedIn(true, data.user?.id, data.user?.email ?? undefined);
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

  // "height" on Android (not "padding" — that's iOS-only in practice, it
  // no-ops there) actually shrinks this view when the keyboard opens, which
  // is what was missing: the email field (last in the form, and this screen
  // centers its content vertically) was sitting behind the keyboard with
  // nothing pushing it back into view.
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={mode === 'signup' ? 'new-password' : 'password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              returnKeyType="next"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(v => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
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

          {mode === 'login' && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} activeOpacity={0.85}>
                <Ionicons name="logo-google" size={18} color={Colors.textPrimary} />
                <Text style={styles.googleText}>Log in with Google</Text>
              </TouchableOpacity>
              <Text style={styles.googleCaption}>Uses your Google account directly — no separate username or password needed.</Text>
            </>
          )}
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
  passwordWrap: { justifyContent: 'center' },
  passwordInput: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: Spacing.md, height: '100%', justifyContent: 'center' },
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
});
