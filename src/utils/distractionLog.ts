import AsyncStorage from '@react-native-async-storage/async-storage';
import { now as devNow } from './devClock';

// How long the app was backgrounded *during an active focus session* —
// the one distraction signal we can measure honestly without a native
// module. Not "time spent in Instagram" (that needs the Usage Access
// permission + a native build we don't have yet), just "time you left
// TINT while a session was running."
export interface DistractionLogEntry {
  date: string;
  mins: number;
}

const DISTRACTION_LOG_KEY = 'tint_distraction_log';

export async function loadDistractionLog(): Promise<DistractionLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(DISTRACTION_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveDistractionLog(log: DistractionLogEntry[]): Promise<void> {
  await AsyncStorage.setItem(DISTRACTION_LOG_KEY, JSON.stringify(log));
}

export function computeDistractedToday(log: DistractionLogEntry[]): number {
  const todayStr = devNow().toDateString();
  return log.filter(e => e.date === todayStr).reduce((s, e) => s + e.mins, 0);
}
