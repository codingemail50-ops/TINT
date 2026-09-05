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
  /** Which exam(s) this person is prepping for — used for the per-exam
   *  leaderboard toggle, since raw focus time isn't a fair comparison
   *  across different exams. */
  exams?: string[];
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
