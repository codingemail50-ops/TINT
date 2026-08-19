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

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MS_PER_DAY = 86400000;

export type FocusTimeframe = 'week' | 'month' | 'year' | 'allTime';

export interface FocusBucket { label: string; mins: number }

export interface FocusSummary {
  buckets: FocusBucket[];
  periodLabel: string;
  totalMins: number;
  sessionCount: number;
  avgMinsPerDay: number;
  avgSessionsPerDay: number;
}

// Buckets + rollup totals for a timeframe, so the Insights screen can show
// one consistent "Duration / Sessions / Avg per day" summary no matter
// which tab is selected — averages are per calendar day elapsed in the
// period, not per active day, matching how the reference design reads.
export function getFocusSummary(log: FocusLogEntry[], timeframe: FocusTimeframe): FocusSummary {
  const now = new Date();

  if (timeframe === 'week') {
    const buckets: FocusBucket[] = [];
    let totalMins = 0, sessionCount = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const entries = log.filter(e => e.date === d.toDateString());
      const mins = entries.reduce((s, e) => s + e.mins, 0);
      totalMins += mins; sessionCount += entries.length;
      buckets.push({ label: DAY_LABELS[d.getDay()], mins });
    }
    return { buckets, periodLabel: 'This Week', totalMins, sessionCount, avgMinsPerDay: totalMins / 7, avgSessionsPerDay: sessionCount / 7 };
  }

  if (timeframe === 'month') {
    const year = now.getFullYear(), month = now.getMonth();
    const daysElapsed = now.getDate();
    const buckets: FocusBucket[] = [];
    let totalMins = 0, sessionCount = 0;
    for (let day = 1; day <= daysElapsed; day++) {
      const dateStr = new Date(year, month, day).toDateString();
      const entries = log.filter(e => e.date === dateStr);
      const mins = entries.reduce((s, e) => s + e.mins, 0);
      totalMins += mins; sessionCount += entries.length;
      buckets.push({ label: day === 1 || day % 5 === 1 ? String(day) : '', mins });
    }
    return { buckets, periodLabel: `${MONTH_LABELS[month]} ${year}`, totalMins, sessionCount, avgMinsPerDay: totalMins / daysElapsed, avgSessionsPerDay: sessionCount / daysElapsed };
  }

  if (timeframe === 'year') {
    const year = now.getFullYear();
    const monthsElapsed = now.getMonth() + 1;
    const daysElapsed = Math.round((now.getTime() - new Date(year, 0, 1).getTime()) / MS_PER_DAY) + 1;
    const buckets: FocusBucket[] = [];
    let totalMins = 0, sessionCount = 0;
    for (let m = 0; m < monthsElapsed; m++) {
      const entries = log.filter(e => {
        const d = new Date(e.date);
        return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === m;
      });
      const mins = entries.reduce((s, e) => s + e.mins, 0);
      totalMins += mins; sessionCount += entries.length;
      buckets.push({ label: MONTH_LABELS[m], mins });
    }
    return { buckets, periodLabel: String(year), totalMins, sessionCount, avgMinsPerDay: totalMins / daysElapsed, avgSessionsPerDay: sessionCount / daysElapsed };
  }

  // allTime — bucket by calendar month from the earliest log entry to now.
  const validDates = log.map(e => new Date(e.date)).filter(d => !isNaN(d.getTime()));
  const earliest = validDates.length > 0 ? new Date(Math.min(...validDates.map(d => d.getTime()))) : now;
  const daysElapsed = Math.max(1, Math.round((now.getTime() - earliest.getTime()) / MS_PER_DAY) + 1);

  const byMonth = new Map<string, number>();
  const orderedKeys: string[] = [];
  const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    byMonth.set(key, 0);
    orderedKeys.push(key);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  let totalMins = 0, sessionCount = 0;
  for (const e of log) {
    const d = new Date(e.date);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + e.mins);
    totalMins += e.mins; sessionCount += 1;
  }
  const buckets = orderedKeys.map(key => {
    const m = Number(key.split('-')[1]);
    return { label: MONTH_LABELS[m], mins: byMonth.get(key) ?? 0 };
  });
  return { buckets, periodLabel: 'All Time', totalMins, sessionCount, avgMinsPerDay: totalMins / daysElapsed, avgSessionsPerDay: sessionCount / daysElapsed };
}
