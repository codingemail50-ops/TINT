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

// "Hours minutes and seconds" per spec — seconds are always :00 since focus
// time is only ever tracked to minute precision, not a fabricated number.
export function formatHMS(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}:${String(m).padStart(2, '0')}:00`;
}
