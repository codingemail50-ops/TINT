import AsyncStorage from '@react-native-async-storage/async-storage';
import { now as devNow } from './devClock';

export interface FocusLogEntry {
  date: string;
  mins: number;
  /** ISO wall-clock moment the session happened — optional since entries
   *  logged before this field existed won't have it. Powers the hour-by-hour
   *  "Day" timeframe; every other timeframe only ever needed `date`. */
  timestamp?: string;
}

const FOCUS_LOG_KEY = 'tint_focus_log';
const BEST_FLAME_MINS_KEY = 'tint_best_flame_mins';

// The highest single-day focus total ever reached — the home-screen
// flame's stage never drops below whatever this represents, even at the
// start of a brand-new day with 0 minutes logged yet (see Bonfire.tsx).
// Device-local only, same as the focus log itself; purely cosmetic, no
// need to sync it anywhere.
export async function loadBestFlameMins(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BEST_FLAME_MINS_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch { return 0; }
}

export async function saveBestFlameMins(mins: number): Promise<void> {
  try { await AsyncStorage.setItem(BEST_FLAME_MINS_KEY, String(mins)); } catch {}
}

// Highest total any single calendar date reaches in a log — used to
// re-derive the flame's carry-over floor from an account's real synced
// history on login (rather than zeroing it out, which would undo the
// carry-over the moment someone logs into an existing account on a new or
// cleared device).
export function bestSingleDayMinutes(log: FocusLogEntry[]): number {
  const byDate = new Map<string, number>();
  for (const entry of log) byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + entry.mins);
  return Math.max(0, ...byDate.values());
}

// Today and the Focus tab both stay mounted permanently now (so a running
// session survives tab switches), which means they each hold their own
// snapshot of the focus log loaded once on mount — with no signal telling
// one to refresh when the *other* logs a session, "focused for a minute"
// would show up in Insights (which reloads fresh every visit) but nowhere
// on the already-mounted screens. This is that signal.
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeFocusLog(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  for (const l of listeners) l();
}

// A task-linked focus session naturally completing used to log its minutes
// twice — once in FocusScreen's own completion handler, once again in
// Today's screen right after (since fixed, see TodoScreen's
// handleTaskSessionFinish) — leaving two back-to-back entries with the
// same date and (near enough) the same duration, logged within a second or
// two of each other. Real, separately-run sessions essentially never land
// on that exact signature by coincidence, so it's safe to treat as the bug
// and collapse it to one entry. This runs on every read so a device that
// already picked up the bug self-heals the next time the app is opened,
// instead of staying permanently inflated until someone manually fixes the
// data.
function dedupeFocusLog(log: FocusLogEntry[]): FocusLogEntry[] {
  const cleaned: FocusLogEntry[] = [];
  for (const entry of log) {
    const prev = cleaned[cleaned.length - 1];
    const isDupOfPrev = !!prev
      && prev.date === entry.date
      && Math.abs(prev.mins - entry.mins) < 0.01
      && !!prev.timestamp && !!entry.timestamp
      && Math.abs(new Date(entry.timestamp).getTime() - new Date(prev.timestamp).getTime()) < 5000;
    if (!isDupOfPrev) cleaned.push(entry);
  }
  return cleaned;
}

export async function loadFocusLog(): Promise<FocusLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(FOCUS_LOG_KEY);
    const log: FocusLogEntry[] = raw ? JSON.parse(raw) : [];
    const cleaned = dedupeFocusLog(log);
    if (cleaned.length !== log.length) {
      // Persist the repair directly (not via saveFocusLog, which would
      // fire subscribeFocusLog's listeners for what's really just a read)
      // so it isn't redetected and rewritten on every subsequent read.
      AsyncStorage.setItem(FOCUS_LOG_KEY, JSON.stringify(cleaned)).catch(() => {});
    }
    return cleaned;
  } catch { return []; }
}

export async function saveFocusLog(log: FocusLogEntry[]): Promise<void> {
  await AsyncStorage.setItem(FOCUS_LOG_KEY, JSON.stringify(log));
  notify();
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const result = new Date(d);
  result.setDate(d.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function computeFocusStats(log: FocusLogEntry[]): { today: number; week: number; allTime: number } {
  const todayStr = devNow().toDateString();
  const weekStart = startOfWeek(devNow());

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
    const d = devNow();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    const mins = log.filter(e => e.date === dateStr).reduce((s, e) => s + e.mins, 0);
    result.push({ day: DAY_LABELS[d.getDay()], mins, date: dateStr });
  }
  return result;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MS_PER_DAY = 86400000;

// Any day with a real focus session logged (not "no data") — the honest
// signal for "did the user actually focus," separate from task-completion
// consistency %. Used for the binary orange/grey heatmap.
export function getFocusHeatmap(log: FocusLogEntry[], days = 70): { date: string; focused: boolean }[] {
  const byDate = new Set(log.filter(e => e.mins > 0).map(e => e.date));
  const result: { date: string; focused: boolean }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = devNow();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    result.push({ date: dateStr, focused: byDate.has(dateStr) });
  }
  return result;
}

export type FocusTimeframe = 'day' | 'week' | 'month' | 'allTime';

export interface FocusBucket { label: string; mins: number; distractedMins: number; dateLabel: string }

export interface FocusSummary {
  buckets: FocusBucket[];
  periodLabel: string;
  totalMins: number;
  sessionCount: number;
  avgMinsPerDay: number;
  avgSessionsPerDay: number;
}

function sumMins(log: { date: string; mins: number }[], dateStr: string): number {
  let sum = 0;
  for (const e of log) if (e.date === dateStr) sum += e.mins;
  return sum;
}

function shortDate(d: Date): string {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

function formatHourLabel(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${period}`;
}

// Buckets + rollup totals for a timeframe, so the Insights screen can show
// one consistent "Duration / Sessions / Avg per day" summary no matter
// which tab is selected — averages are per calendar day elapsed in the
// period, not per active day, matching how the reference design reads.
// distractionLog is optional so callers that don't care about the
// focus-vs-distracted chart (or don't have the data loaded yet) can omit it.
export function getFocusSummary(
  log: FocusLogEntry[],
  timeframe: FocusTimeframe,
  distractionLog: { date: string; mins: number; timestamp?: string }[] = []
): FocusSummary {
  const now = devNow();

  if (timeframe === 'day') {
    const todayStr = now.toDateString();
    const hourMins = new Array(24).fill(0);
    const hourDistracted = new Array(24).fill(0);
    let totalMins = 0, sessionCount = 0;

    for (const e of log) {
      if (e.date !== todayStr) continue;
      totalMins += e.mins; sessionCount += 1;
      if (e.timestamp) {
        const h = new Date(e.timestamp).getHours();
        if (h >= 0 && h < 24) hourMins[h] += e.mins;
      }
    }
    for (const e of distractionLog) {
      if (e.date !== todayStr || !e.timestamp) continue;
      const h = new Date(e.timestamp).getHours();
      if (h >= 0 && h < 24) hourDistracted[h] += e.mins;
    }

    const buckets: FocusBucket[] = [];
    for (let h = 0; h < 24; h++) {
      buckets.push({
        label: formatHourLabel(h),
        mins: hourMins[h],
        distractedMins: hourDistracted[h],
        dateLabel: `${formatHourLabel(h)} Today`,
      });
    }
    return { buckets, periodLabel: 'Today', totalMins, sessionCount, avgMinsPerDay: totalMins, avgSessionsPerDay: sessionCount };
  }

  if (timeframe === 'week') {
    const buckets: FocusBucket[] = [];
    let totalMins = 0, sessionCount = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const entries = log.filter(e => e.date === dateStr);
      const mins = entries.reduce((s, e) => s + e.mins, 0);
      totalMins += mins; sessionCount += entries.length;
      buckets.push({ label: DAY_LABELS[d.getDay()], mins, distractedMins: sumMins(distractionLog, dateStr), dateLabel: shortDate(d) });
    }
    return { buckets, periodLabel: 'This Week', totalMins, sessionCount, avgMinsPerDay: totalMins / 7, avgSessionsPerDay: sessionCount / 7 };
  }

  if (timeframe === 'month') {
    const year = now.getFullYear(), month = now.getMonth();
    const daysElapsed = now.getDate();
    const buckets: FocusBucket[] = [];
    let totalMins = 0, sessionCount = 0;
    for (let day = 1; day <= daysElapsed; day++) {
      const d = new Date(year, month, day);
      const dateStr = d.toDateString();
      const entries = log.filter(e => e.date === dateStr);
      const mins = entries.reduce((s, e) => s + e.mins, 0);
      totalMins += mins; sessionCount += entries.length;
      buckets.push({ label: String(day), mins, distractedMins: sumMins(distractionLog, dateStr), dateLabel: shortDate(d) });
    }
    return { buckets, periodLabel: `${MONTH_LABELS[month]} ${year}`, totalMins, sessionCount, avgMinsPerDay: totalMins / daysElapsed, avgSessionsPerDay: sessionCount / daysElapsed };
  }

  // allTime — bucket by calendar month from the earliest log entry to now.
  const validDates = log.map(e => new Date(e.date)).filter(d => !isNaN(d.getTime()));
  const earliest = validDates.length > 0 ? new Date(Math.min(...validDates.map(d => d.getTime()))) : now;
  const daysElapsed = Math.max(1, Math.round((now.getTime() - earliest.getTime()) / MS_PER_DAY) + 1);

  const byMonth = new Map<string, number>();
  const byMonthDistracted = new Map<string, number>();
  const orderedKeys: string[] = [];
  const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    byMonth.set(key, 0);
    byMonthDistracted.set(key, 0);
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
  for (const e of distractionLog) {
    const d = new Date(e.date);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (byMonthDistracted.has(key)) byMonthDistracted.set(key, (byMonthDistracted.get(key) ?? 0) + e.mins);
  }
  const buckets = orderedKeys.map(key => {
    const [y, m] = key.split('-').map(Number);
    return { label: MONTH_LABELS[m], mins: byMonth.get(key) ?? 0, distractedMins: byMonthDistracted.get(key) ?? 0, dateLabel: `${MONTH_LABELS[m]} ${y}` };
  });
  return { buckets, periodLabel: 'All Time', totalMins, sessionCount, avgMinsPerDay: totalMins / daysElapsed, avgSessionsPerDay: sessionCount / daysElapsed };
}
