import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { AppState, UserProfile, computeLifetimeConsistency } from './storage';

// ── Types for the user_data row ──────────────────────────────────────────────
interface UserDataRow {
  id: string;
  email: string;
  name: string;
  avatar: string;
  exams: string[];
  streak: number;
  longest_streak: number;
  last_active_date: string | null;
  total_tasks_completed: number;
  history: AppState['history'];
  today_tasks: unknown;
  today_tasks_date: string | null;
}

// ── Save a brand-new user to Supabase (upsert) ───────────────────────────────
export async function saveNewUserToSupabase(
  userId: string,
  email: string,
  profile: Omit<UserProfile, 'email'>
): Promise<void> {
  try {
    const row: Partial<UserDataRow> = {
      id: userId,
      email,
      name: profile.name,
      avatar: profile.avatar,
      exams: profile.examTypes,
      streak: 0,
      longest_streak: 0,
      last_active_date: null,
      total_tasks_completed: 0,
      history: [],
      today_tasks: null,
      today_tasks_date: null,
    };

    const { error } = await supabase
      .from('user_data')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.error('[supabaseStorage] saveNewUserToSupabase error:', error.message);
    }
  } catch (err) {
    console.error('[supabaseStorage] saveNewUserToSupabase exception:', err);
  }
}

// ── Load a user's AppState from Supabase, also cache to AsyncStorage ─────────
export async function loadUserFromSupabase(userId: string): Promise<AppState | null> {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      if (error?.code !== 'PGRST116') {
        // PGRST116 = no rows found — not an actual error
        console.error('[supabaseStorage] loadUserFromSupabase error:', error?.message);
      }
      return null;
    }

    const row = data as UserDataRow;

    const userProfile: UserProfile = {
      name: row.name ?? '',
      email: row.email ?? '',
      examTypes: Array.isArray(row.exams) ? row.exams : [],
      avatar: row.avatar ?? '🎯',
      createdAt: new Date().toISOString(),
    };

    const appState: AppState = {
      user: userProfile,
      streak: row.streak ?? 0,
      longestStreak: row.longest_streak ?? 0,
      lastActiveDate: row.last_active_date ?? null,
      history: Array.isArray(row.history) ? row.history : [],
      totalTasksCompleted: row.total_tasks_completed ?? 0,
    };

    // Cache to AsyncStorage for offline fallback
    try {
      await AsyncStorage.setItem('tint_user', JSON.stringify(userProfile));
      await AsyncStorage.setItem('tint_app_state', JSON.stringify(appState));
    } catch (cacheErr) {
      console.warn('[supabaseStorage] Failed to cache to AsyncStorage:', cacheErr);
    }

    return appState;
  } catch (err) {
    console.error('[supabaseStorage] loadUserFromSupabase exception:', err);
    return null;
  }
}

// ── Sync the current AppState to Supabase (update existing row) ──────────────
export async function syncAppStateToSupabase(
  userId: string,
  appState: AppState
): Promise<void> {
  try {
    const updates: Partial<UserDataRow> = {
      streak: appState.streak,
      longest_streak: appState.longestStreak,
      last_active_date: appState.lastActiveDate,
      total_tasks_completed: appState.totalTasksCompleted,
      history: appState.history,
    };

    if (appState.user) {
      updates.name = appState.user.name;
      updates.avatar = appState.user.avatar;
      updates.exams = appState.user.examTypes;
    }

    const { error } = await supabase
      .from('user_data')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('[supabaseStorage] syncAppStateToSupabase error:', error.message);
    }
  } catch (err) {
    console.error('[supabaseStorage] syncAppStateToSupabase exception:', err);
  }
}

// ── Sync the focus log to Supabase (update existing row's focus_log jsonb) ──
export async function syncFocusLog(
  userId: string,
  focusLog: { date: string; mins: number }[]
): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_data')
      .update({ focus_log: focusLog })
      .eq('id', userId);

    if (error) {
      console.error('[supabaseStorage] syncFocusLog error:', error.message);
    }
  } catch (err) {
    console.error('[supabaseStorage] syncFocusLog exception:', err);
  }
}

// ── Check whether a user row already exists in Supabase ─────────────────────
export async function checkUserExists(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('id')
      .eq('id', userId)
      .single();

    if (error) {
      // PGRST116 means no row found
      if (error.code === 'PGRST116') return false;
      console.error('[supabaseStorage] checkUserExists error:', error.message);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('[supabaseStorage] checkUserExists exception:', err);
    return false;
  }
}

// ── Leaderboard: every user's public-facing row ──────────────────────────────
export interface CloudLeaderboardRow {
  id: string;
  name: string;
  avatar: string;
  exams: string[];
  streak: number;
  consistency: number;
  tasksCompleted: number;
}

export async function loadLeaderboard(): Promise<CloudLeaderboardRow[]> {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('id, name, avatar, exams, streak, history, total_tasks_completed')
      .order('streak', { ascending: false })
      .limit(100);

    if (error || !data) {
      if (error) console.error('[supabaseStorage] loadLeaderboard error:', error.message);
      return [];
    }

    return (data as UserDataRow[]).map(row => ({
      id: row.id,
      name: row.name || 'Anonymous',
      avatar: row.avatar || '⭐',
      exams: Array.isArray(row.exams) ? row.exams : [],
      streak: row.streak ?? 0,
      consistency: computeLifetimeConsistency(Array.isArray(row.history) ? row.history : []),
      tasksCompleted: row.total_tasks_completed ?? 0,
    }));
  } catch (err) {
    console.error('[supabaseStorage] loadLeaderboard exception:', err);
    return [];
  }
}
