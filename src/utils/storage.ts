import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../data/examPresets';

export interface UserProfile {
  name: string;
  email: string;
  examTypes: string[]; // multi-select
  avatar: string;
  createdAt: string;
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

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (consistency >= 50) {
      if (state.lastActiveDate === yesterdayStr) state.streak += 1;
      else if (state.lastActiveDate !== today) state.streak = 1;
      state.lastActiveDate = today;
    }

    state.longestStreak = Math.max(state.longestStreak, state.streak);
    state.totalTasksCompleted += completed;
    await this.saveAppState(state);
    return state;
  },
};

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
