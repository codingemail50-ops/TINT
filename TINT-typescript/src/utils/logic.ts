import { Task, HistoryEntry, FocusLog } from '../types';

export function getAppDate(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

export function calcProgress(tasks: Task[]): { pct: number; allDone: boolean } {
  const study = tasks.filter(t => t.cat !== 'health');
  if (study.length === 0) return { pct: 0, allDone: false };
  const done = study.filter(t => t.status === 'done');
  const pct = Math.round((done.length / study.length) * 100);
  const allDone = done.length === study.length;
  return { pct, allDone };
}

export function buildHistoryEntry(tasks: Task[], date: string): HistoryEntry {
  const study = tasks.filter(t => t.cat !== 'health');
  const done = study.filter(t => t.status === 'done');
  const missed = tasks.filter(t => t.status === 'missed');
  const pct = study.length > 0 ? Math.round((done.length / study.length) * 100) : 0;
  const allDone = done.length === study.length && study.length > 0;
  return {
    date,
    allDone,
    pct,
    missedCount: missed.length,
    skippedTask: missed[0]?.title ?? null,
    missedTasks: tasks.filter(t => t.status !== 'done').map(t => t.title),
  };
}

export function calcStreak(history: HistoryEntry[]): { streak: number; missedDays: number } {
  const today = getAppDate();
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  let missedDays = 0;
  for (const e of sorted) {
    if (e.allDone) {
      streak++;
      missedDays = 0;
    } else if (e.date === today) {
      continue;
    } else {
      missedDays++;
      streak = 0;
      break;
    }
  }
  return { streak, missedDays };
}

export function calcConsistency(history: HistoryEntry[]): number {
  if (history.length === 0) return 0;
  return Math.round((history.filter(h => h.allDone).length / history.length) * 100);
}

export function projectedRank(streak: number, missedDays: number): number {
  if (missedDays >= 14) return 3500;
  if (missedDays >= 7) return 2500;
  if (missedDays >= 5) return 2000;
  if (missedDays >= 3) return 1500;
  if (missedDays >= 2) return 1000;
  if (missedDays >= 1) return 750;
  if (streak >= 14) return 51;
  if (streak >= 10) return 51;
  if (streak >= 7) return 65;
  if (streak >= 3) return 80;
  return 300;
}

export function calcFocusMetrics(focusLog: FocusLog[]): {
  focusToday: number;
  focusWeek: number;
  focusTotal: number;
} {
  const today = getAppDate();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const focusToday = focusLog
    .filter(e => e.date === today)
    .reduce((s, e) => s + e.mins, 0);
  const focusWeek = focusLog
    .filter(e => e.date >= weekStartStr)
    .reduce((s, e) => s + e.mins, 0);
  const focusTotal = focusLog.reduce((s, e) => s + e.mins, 0);

  return { focusToday, focusWeek, focusTotal };
}

export function getStreakColor(streak: number): string {
  if (streak >= 30) return '#22C55E';
  if (streak >= 22) return '#A855F7';
  if (streak >= 15) return '#3B82F6';
  if (streak >= 8) return '#EF4444';
  if (streak >= 4) return '#F97316';
  return '#FBBF24';
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function daysUntil(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000));
}

export function getRepeatedlySkippedTasks(history: HistoryEntry[], tasks: Task[]): string[] {
  if (history.length < 3) return [];
  const recent = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  const skipCount: Record<string, number> = {};
  for (const entry of recent) {
    for (const title of entry.missedTasks) {
      skipCount[title] = (skipCount[title] ?? 0) + 1;
    }
  }
  return Object.entries(skipCount)
    .filter(([, count]) => count >= 3)
    .map(([title]) => title);
}
