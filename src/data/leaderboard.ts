export interface LeaderboardEntry {
  id: string;
  name: string;
  streak: number;
  consistency: number;
  tasksCompleted: number;
  avatar: string;
  focusTodayMins: number;
  focusWeekMins: number;
  focusAllTimeMins: number;
  isCurrentUser?: boolean;
}

export type LeaderboardPeriod = 'today' | 'week' | 'overall';

export function minsForPeriod(entry: LeaderboardEntry, period: LeaderboardPeriod): number {
  if (period === 'today') return entry.focusTodayMins;
  if (period === 'week') return entry.focusWeekMins;
  return entry.focusAllTimeMins;
}

// Real seconds now — totalMins can carry sub-minute precision (a session
// that ended early logs its exact elapsed time, not a rounded minute), so
// ranking and display both go down to the second instead of tying at the
// whole minute.
export function formatHMS(totalMins: number): string {
  const totalSeconds = Math.round(totalMins * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Placeholder rows so the leaderboard doesn't render empty before the
// Supabase schema update (focus_*_mins columns) is applied — only ever
// used as a fallback when the real query comes back with zero rows, never
// blended with real users. Fixed values, not Math.random(), so the screen
// doesn't visibly reshuffle on every re-render.
export const MOCK_LEADERBOARD_BOTS: LeaderboardEntry[] = [
  { id: 'bot-1', name: 'RIYA_K', avatar: 'fox', streak: 21, consistency: 92, tasksCompleted: 140, focusTodayMins: 185, focusWeekMins: 920, focusAllTimeMins: 14340 },
  { id: 'bot-2', name: 'ARJUN.D', avatar: 'panda', streak: 14, consistency: 88, tasksCompleted: 121, focusTodayMins: 160, focusWeekMins: 845, focusAllTimeMins: 12100 },
  { id: 'bot-3', name: 'MEERA_S', avatar: 'cat', streak: 30, consistency: 95, tasksCompleted: 168, focusTodayMins: 145, focusWeekMins: 780, focusAllTimeMins: 18650 },
  { id: 'bot-4', name: 'KABIR99', avatar: 'watermelon', streak: 9, consistency: 81, tasksCompleted: 96, focusTodayMins: 120, focusWeekMins: 610, focusAllTimeMins: 8300 },
  { id: 'bot-5', name: 'SANA_R', avatar: 'strawberry', streak: 17, consistency: 90, tasksCompleted: 133, focusTodayMins: 105, focusWeekMins: 590, focusAllTimeMins: 10700 },
  { id: 'bot-6', name: 'VIHAAN.P', avatar: 'pizza', streak: 5, consistency: 74, tasksCompleted: 60, focusTodayMins: 90, focusWeekMins: 430, focusAllTimeMins: 5200 },
  { id: 'bot-7', name: 'ISHA_T', avatar: 'donut', streak: 12, consistency: 86, tasksCompleted: 104, focusTodayMins: 75, focusWeekMins: 380, focusAllTimeMins: 7400 },
  { id: 'bot-8', name: 'DEV_M', avatar: 'mushroom', streak: 3, consistency: 68, tasksCompleted: 40, focusTodayMins: 40, focusWeekMins: 210, focusAllTimeMins: 2900 },
];
