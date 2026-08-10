import AsyncStorage from '@react-native-async-storage/async-storage';

export const FOCUS_LOG_KEY = 'tint_focus_log';

export interface FocusLogEntry {
  date: string;
  mins: number;
}

export async function loadFocusLog(): Promise<FocusLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(FOCUS_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
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

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
