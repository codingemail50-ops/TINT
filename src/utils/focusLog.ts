import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FocusLogEntry {
  date: string;
  mins: number;
}

const FOCUS_LOG_KEY = 'tint_focus_log';

export async function loadFocusLog(): Promise<FocusLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(FOCUS_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveFocusLog(log: FocusLogEntry[]): Promise<void> {
  await AsyncStorage.setItem(FOCUS_LOG_KEY, JSON.stringify(log));
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const result = new Date(d);
  result.setDate(d.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function computeFocusStats(log: FocusLogEntry[]): { today: number; week: number; allTime: number } {
  const todayStr = new Date().toDateString();
  const weekStart = startOfWeek(new Date());

  let today = 0, week = 0, allTime = 0;
  for (const entry of log) {
    allTime += entry.mins;
    if (entry.date === todayStr) today += entry.mins;
    const entryDate = new Date(entry.date);
    if (!isNaN(entryDate.getTime()) && entryDate >= weekStart) week += entry.mins;
  }
  return { today, week, allTime };
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function getLast7DaysFocus(log: FocusLogEntry[]): { day: string; mins: number; date: string }[] {
  const result: { day: string; mins: number; date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    const mins = log.filter(e => e.date === dateStr).reduce((s, e) => s + e.mins, 0);
    result.push({ day: DAY_LABELS[d.getDay()], mins, date: dateStr });
  }
  return result;
}
