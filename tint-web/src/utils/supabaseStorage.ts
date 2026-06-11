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
      consistency_score: 0,
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

    saveUser(profile)
    saveAppState(appState)

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
    const totalDays = state.history.length
    const perfectDays = state.history.filter((h) => h.consistency >= 100).length
    const consistencyScore = totalDays > 0 ? Math.round((perfectDays / totalDays) * 100) : 0

    await supabase.from('user_data').upsert({
      id: userId,
      name: state.user.name,
      avatar: state.user.avatar,
      exams: state.user.examTypes,
      streak: state.streak,
      longest_streak: state.longestStreak,
      last_active_date: state.lastActiveDate,
      total_tasks_completed: state.totalTasksCompleted,
      consistency_score: consistencyScore,
      history: state.history,
    })
  } catch {
    // ignore
  }
}

export interface LeaderboardRow {
  id: string
  name: string
  avatar: string
  streak: number
  consistency_score: number
  isYou?: boolean
  rank?: number
}

export async function loadLeaderboard(): Promise<LeaderboardRow[]> {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('id, name, avatar, streak, consistency_score')
      .order('consistency_score', { ascending: false })
      .order('streak', { ascending: false })
      .order('name', { ascending: true })
      .limit(50)
    if (error || !data) return []
    return data as LeaderboardRow[]
  } catch {
    return []
  }
}
