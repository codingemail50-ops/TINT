import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, FutureGoal } from './storage';
import { Task } from '../data/examPresets';
import { FocusLogEntry } from './focusLog';
import { now as devNow } from './devClock';

const LAST_SHOWN_KEY = 'tint_daily_recap_last_shown';

export interface DailyRecapData {
  name: string;
  /** Raw devNow().toDateString() key for yesterday — used to track whether
   *  this recap has already been shown, kept separate from dateLabel since
   *  that's just a short display string ("Jan 5") that isn't unique across years. */
  dateKey: string;
  dateLabel: string;
  goalText: string | null;
  daysLeft: number | null;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  focusMins: number;
  focusGoalMins: number;
  focusAccuracy: number; // 0-100, focusMins / focusGoalMins
}

function yesterdayDateString(): string {
  const d = devNow();
  d.setDate(d.getDate() - 1);
  return d.toDateString();
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
function formatShortDate(d: Date): string {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

function daysUntil(targetIso: string): number {
  const [y, m, d] = targetIso.split('-').map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  const today = devNow();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

// Builds yesterday's recap from data that's already sitting in local
// storage (appState.history already has a live-updated DayRecord for any
// day at least one task was toggled on, and the focus log is keyed by the
// same devNow().toDateString() convention) — no extra fetch needed.
export function buildYesterdayRecap(appState: AppState, focusLog: FocusLogEntry[]): DailyRecapData | null {
  if (!appState.user) return null;
  const yesterday = yesterdayDateString();
  const record = appState.history.find(h => h.date === yesterday);
  const focusMins = Math.round(focusLog.filter(e => e.date === yesterday).reduce((s, e) => s + e.mins, 0));

  const tasks = record?.tasks ?? [];
  // Nothing tracked at all that day — not worth interrupting the user with
  // an empty card.
  if (tasks.length === 0 && focusMins === 0) return null;

  const goal: FutureGoal | null | undefined = appState.user.futureGoal;
  const focusGoalMins = appState.user.dailyFocusGoalMins || 60;

  return {
    name: appState.user.name || 'You',
    dateKey: yesterday,
    dateLabel: formatShortDate(new Date(yesterday)),
    goalText: goal?.text ?? null,
    daysLeft: goal?.targetDate ? daysUntil(goal.targetDate) : null,
    tasks,
    completedCount: tasks.filter(t => t.completed).length,
    totalCount: tasks.length,
    focusMins,
    focusGoalMins,
    focusAccuracy: focusGoalMins > 0 ? Math.round((focusMins / focusGoalMins) * 100) : 0,
  };
}

export async function hasShownRecapFor(dateKey: string): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    return last === dateKey;
  } catch { return false; }
}

export async function markRecapShown(dateKey: string): Promise<void> {
  try { await AsyncStorage.setItem(LAST_SHOWN_KEY, dateKey); } catch {}
}
