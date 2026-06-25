import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, HistoryEntry, FocusLog, UserProfile } from '../types';

const KEYS = {
  NAME: 'tint_name',
  AVATAR: 'tint_avatar',
  EMAIL: 'tint_email',
  EXAMS: 'tint_exams',
  TASKS: 'tint_tasks',
  HISTORY: 'tint_history',
  FOCUS_LOG: 'tint_focus_log',
  ONBOARDED: 'tint_onboarded',
  LAST_RESET: 'tint_last_reset',
  BLOCKED_APPS: 'tint_blocked_apps',
};

async function get<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function set(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const storage = {
  getProfile: () =>
    Promise.all([
      get<string>(KEYS.NAME, ''),
      get<string>(KEYS.AVATAR, '⭐'),
      get<string>(KEYS.EMAIL, ''),
      get<string[]>(KEYS.EXAMS, []),
    ]).then(([name, avatar, email, exams]) => ({ name, avatar, email, exams } as UserProfile)),

  setProfile: async (p: UserProfile) => {
    await set(KEYS.NAME, p.name);
    await set(KEYS.AVATAR, p.avatar);
    await set(KEYS.EMAIL, p.email);
    await set(KEYS.EXAMS, p.exams);
  },

  getTasks: () => get<Task[]>(KEYS.TASKS, []),
  setTasks: (tasks: Task[]) => set(KEYS.TASKS, tasks),

  getHistory: () => get<HistoryEntry[]>(KEYS.HISTORY, []),
  setHistory: (history: HistoryEntry[]) => set(KEYS.HISTORY, history),

  getFocusLog: () => get<FocusLog[]>(KEYS.FOCUS_LOG, []),
  setFocusLog: (log: FocusLog[]) => set(KEYS.FOCUS_LOG, log),

  getOnboarded: () => get<boolean>(KEYS.ONBOARDED, false),
  setOnboarded: () => set(KEYS.ONBOARDED, true),

  getLastReset: () => get<string>(KEYS.LAST_RESET, ''),
  setLastReset: (date: string) => set(KEYS.LAST_RESET, date),

  getBlockedApps: () => get<string[]>(KEYS.BLOCKED_APPS, ['instagram', 'youtube', 'tiktok']),
  setBlockedApps: (apps: string[]) => set(KEYS.BLOCKED_APPS, apps),

  clearAll: async () => {
    for (const key of Object.values(KEYS)) {
      await AsyncStorage.removeItem(key);
    }
  },
};
