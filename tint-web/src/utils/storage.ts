import type { Task } from '../data/examPresets'
import { getCombinedPreset } from '../data/examPresets'

export interface UserProfile {
  name: string
  avatar: string
  examTypes: string[]
  createdAt: string
}

export interface DayRecord {
  date: string
  tasks: Task[]
  completedCount: number
  totalCount: number
  consistency: number
}

export interface AppState {
  user: UserProfile
  streak: number
  longestStreak: number
  lastActiveDate: string
  history: DayRecord[]
  totalTasksCompleted: number
}

export interface ChartPoint {
  date: string
  label: string
  value: number
}

export interface HeatmapCell {
  date: string
  value: number
  level: number // 0-4
}

const USER_KEY = 'tint_user'
const APP_STATE_KEY = 'tint_app_state'
const TODAY_TASKS_KEY = 'tint_today_tasks'

export function getUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch {
    return null
  }
}

export function saveUser(user: UserProfile): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // ignore
  }
}

export function getAppState(): AppState | null {
  try {
    const raw = localStorage.getItem(APP_STATE_KEY)
    return raw ? (JSON.parse(raw) as AppState) : null
  } catch {
    return null
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

export function getTodayTasks(examTypes: string[]): Task[] {
  try {
    const raw = localStorage.getItem(TODAY_TASKS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { date: string; tasks: Task[] }
      if (parsed.date === getTodayString()) {
        return parsed.tasks
      }
    }
  } catch {
    // fall through
  }
  const tasks = getCombinedPreset(examTypes)
  saveTodayTasks(tasks)
  return tasks
}

export function saveTodayTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(
      TODAY_TASKS_KEY,
      JSON.stringify({ date: getTodayString(), tasks })
    )
  } catch {
    // ignore
  }
}

export function recordDayCompletion(tasks: Task[]): AppState {
  const state = getAppState()
  const user = getUser()

  if (!user) {
    throw new Error('No user found')
  }

  const today = getTodayString()
  const completedCount = tasks.filter((t) => t.completed).length
  const totalCount = tasks.length
  const consistency = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const dayRecord: DayRecord = {
    date: today,
    tasks,
    completedCount,
    totalCount,
    consistency,
  }

  const prevState: AppState = state || {
    user,
    streak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    history: [],
    totalTasksCompleted: 0,
  }

  // Update history (replace today if exists)
  const history = prevState.history.filter((d) => d.date !== today)
  history.push(dayRecord)

  // Update streak (need >= 50% consistency)
  let streak = prevState.streak
  let longestStreak = prevState.longestStreak

  if (consistency >= 50) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    if (prevState.lastActiveDate === yesterdayStr || prevState.lastActiveDate === today) {
      streak = prevState.lastActiveDate === today ? streak : streak + 1
    } else if (prevState.lastActiveDate !== today) {
      streak = 1
    }
    longestStreak = Math.max(longestStreak, streak)
  }

  const totalTasksCompleted = prevState.totalTasksCompleted + (completedCount - (
    (state?.history.find((d) => d.date === today)?.completedCount) || 0
  ))

  const newState: AppState = {
    user,
    streak,
    longestStreak,
    lastActiveDate: consistency >= 50 ? today : prevState.lastActiveDate,
    history,
    totalTasksCompleted: Math.max(0, totalTasksCompleted),
  }

  saveAppState(newState)
  return newState
}

export function getConsistencyData(history: DayRecord[]): ChartPoint[] {
  const points: ChartPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const label = i === 0 ? 'Today' : dayNames[d.getDay()]
    const record = history.find((h) => h.date === dateStr)
    points.push({ date: dateStr, label, value: record ? record.consistency : 0 })
  }
  return points
}

export function getHeatmapData(history: DayRecord[]): HeatmapCell[] {
  const cells: HeatmapCell[] = []
  for (let i = 69; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const record = history.find((h) => h.date === dateStr)
    const value = record ? record.consistency : 0
    let level = 0
    if (value >= 80) level = 4
    else if (value >= 60) level = 3
    else if (value >= 40) level = 2
    else if (value > 0) level = 1
    cells.push({ date: dateStr, value, level })
  }
  return cells
}
