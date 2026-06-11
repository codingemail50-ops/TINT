import { supabase } from '../lib/supabase'
import type { AppState, UserProfile, DayRecord } from './storage'
import { saveUser, saveAppState, saveTodayTasks } from './storage'
import type { Task } from '../data/examPresets'

export async function checkUserExists(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    if (error) return false
    return !!data
  } catch {
    return false
  }
}

export async function saveNewUserToSupabase(
  userId: string,
  email: string,
  profile: UserProfile
): Promise<void> {
  try {
    await supabase.from('user_data').insert({
      id: userId,
      email,
      name: profile.name,
      avatar: profile.avatar,
      exams: profile.examTypes,
      streak: 0,
      longest_streak: 0,
      last_active_date: '',
      total_tasks_completed: 0,
      history: [],
    })
  } catch {
    // ignore
  }
}

export async function loadUserFromSupabase(userId: string): Promise<AppState | null> {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null

    const profile: UserProfile = {
      name: data.name as string,
      avatar: data.avatar as string,
      examTypes: (data.exams as string[]) || [],
      createdAt: '',
    }

    const history = (data.history as DayRecord[]) || []

    const appState: AppState = {
      user: profile,
      streak: (data.streak as number) || 0,
      longestStreak: (data.longest_streak as number) || 0,
      lastActiveDate: (data.last_active_date as string) || '',
      history,
      totalTasksCompleted: (data.total_tasks_completed as number) || 0,
    }

    // Sync to localStorage
    saveUser(profile)
    saveAppState(appState)

    // Restore today's tasks if available
    const today = new Date().toISOString().split('T')[0]
    const todayRecord = history.find((h: DayRecord) => h.date === today)
    if (todayRecord) {
      saveTodayTasks(todayRecord.tasks as Task[])
    }

    return appState
  } catch {
    return null
  }
}

export async function syncAppStateToSupabase(
  userId: string,
  state: AppState
): Promise<void> {
  try {
    await supabase.from('user_data').upsert({
      id: userId,
      name: state.user.name,
      avatar: state.user.avatar,
      exams: state.user.examTypes,
      streak: state.streak,
      longest_streak: state.longestStreak,
      last_active_date: state.lastActiveDate,
      total_tasks_completed: state.totalTasksCompleted,
      history: state.history,
    })
  } catch {
    // ignore
  }
}
