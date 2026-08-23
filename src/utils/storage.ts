import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, CustomExam } from '../data/examPresets';

export interface UserProfile {
  name: string;
  email: string;
  examTypes: string[]; // multi-select
  avatar: string;
  createdAt: string;
  dailyFocusGoalMins: number;
  /** Set instead of (or alongside) examTypes when picked via "Other". */
  customExam?: CustomExam;
}

export interface DayRecord {
  date: string;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  consistency: number;
}

export interface AppState {
  user: UserProfile | null;
  streak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  history: DayRecord[];
  totalTasksCompleted: number;
}

const KEYS = {
  USER: 'tint_user',
  APP_STATE: 'tint_app_state',
  TODAY_TASKS: 'tint_today_tasks_v2',
};

export const StorageService = {
  async getUser(): Promise<UserProfile | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.USER);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async saveUser(user: UserProfile): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  },

  async getAppState(): Promise<AppState> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.APP_STATE);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { user: null, streak: 0, longestStreak: 0, lastActiveDate: null, history: [], totalTasksCompleted: 0 };
  },

  async saveAppState(state: AppState): Promise<void> {
    await AsyncStorage.setItem(KEYS.APP_STATE, JSON.stringify(state));
  },

  async getTodayTasks(): Promise<Task[] | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.TODAY_TASKS);
      if (!raw) return null;
      const { date, tasks } = JSON.parse(raw);
      return date === new Date().toDateString() ? tasks : null;
    } catch { return null; }
  },

  async saveTodayTasks(tasks: Task[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.TODAY_TASKS, JSON.stringify({ date: new Date().toDateString(), tasks }));
  },

  async recordDayCompletion(tasks: Task[]): Promise<AppState> {
    const state = await this.getAppState();
    const today = new Date().toDateString();
    const completed = tasks.filter(t => t.completed).length;
    const consistency = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    const dayRecord: DayRecord = { date: today, tasks, completedCount: completed, totalCount: tasks.length, consistency };
    const idx = state.history.findIndex(h => h.date === today);
    if (idx >= 0) state.history[idx] = dayRecord;
    else state.history.push(dayRecord);
    state.history = state.history.slice(-60);

    state.streak = computeStreak(state.history);
    state.lastActiveDate = today;
    state.longestStreak = Math.max(state.longestStreak, state.streak);
    state.totalTasksCompleted += completed;
    await this.saveAppState(state);
    return state;
  },
};

// Streak = consecutive all-tasks-done days counting back from today, walking
// through a 2-day grace window (missing 1-2 days in a row doesn't break it —
// only a 3rd consecutive missed day resets the streak to 0). Today itself is
// skipped while still in progress so an unfinished "today" never breaks
// yesterday's streak.
export function computeStreak(history: DayRecord[]): number {
  if (history.length === 0) return 0;

  const byDate = new Map(history.map(h => [h.date, h]));
  const today = new Date().toDateString();
  const cursor = new Date();

  let streak = 0;
  let consecutiveMissed = 0;

  for (let i = 0; i < 400; i++) {
    const dateStr = cursor.toDateString();
    const entry = byDate.get(dateStr);
    const allDone = !!entry && entry.totalCount > 0 && entry.completedCount === entry.totalCount;

    if (dateStr === today && !allDone) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }

    if (allDone) {
      streak++;
      consecutiveMissed = 0;
    } else {
      consecutiveMissed++;
      if (consecutiveMissed >= 3) break;
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

// Lifetime % of logged days that were fully completed — used for the
// leaderboard's consistency score (distinct from a single day's % or the
// 7-day rolling average shown on the Progress screen).
export function computeLifetimeConsistency(history: DayRecord[]): number {
  if (history.length === 0) return 0;
  const allDoneCount = history.filter(h => h.totalCount > 0 && h.completedCount === h.totalCount).length;
  return Math.round((allDoneCount / history.length) * 100);
}

export function getConsistencyData(history: DayRecord[]): { day: string; value: number; date: string }[] {
  const last7: { day: string; value: number; date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    const record = history.find(h => h.date === dateStr);
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    last7.push({ day: days[d.getDay()], value: record?.consistency ?? 0, date: dateStr });
  }
  return last7;
}

export function getHeatmapData(history: DayRecord[]): { date: string; value: number }[] {
  const result: { date: string; value: number }[] = [];
  for (let i = 69; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    const record = history.find(h => h.date === dateStr);
    result.push({ date: dateStr, value: record?.consistency ?? -1 });
  }
  return result;
}
