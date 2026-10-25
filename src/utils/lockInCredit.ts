// Leaderboard time for a running 7 Day Lock In, for people who also use TINT's
// tasks and Focus tab (regular accounts).
//
// While a Lock In runs, every day of it counts as 12 hours of focus time on
// the leaderboard (84 hours for the full week), earned as the time passes.
// It stops adding the moment the Lock In is left or ends; what was already
// earned stays. Accounts made through the Lock In button only (no exams, no
// tasks) get no credit.
//
// The credit is kept apart from the person's own focus log (the Today screen,
// flame and Progress are not changed by it). It is added in only when the log
// is sent to the leaderboard (see syncFocusLog) and when the person's own row
// is shown on it. Entries are stored one per calendar day, and an entry never
// goes down, so repeating the calculation is always safe.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FocusLogEntry } from './focusLog';
import { loadLocalChallenge, serverNow } from './challenge';

const KEY = 'tint_lockin_credit_v1';
const PREFIX = 'lockin-';
/** 12 hours a day. */
export const CREDIT_MINS_PER_DAY = 12 * 60;

export function isCreditEntry(e: FocusLogEntry): boolean {
  return !!e.sessionId && e.sessionId.startsWith(PREFIX);
}

export async function loadLockInCredit(): Promise<FocusLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

async function saveCredit(list: FocusLogEntry[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export async function clearLockInCredit(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}

/** The person's own log plus the Lock In credit (for the leaderboard only). */
export async function withLockInCredit(log: FocusLogEntry[]): Promise<FocusLogEntry[]> {
  const credit = await loadLockInCredit();
  if (credit.length === 0) return log.filter(e => !isCreditEntry(e));
  return [...log.filter(e => !isCreditEntry(e)), ...credit];
}

/** A log restored from the account on this or another phone: keeps the credit
 *  entries in the credit store (never lowering any) and returns the rest. */
export async function splitRestoredLog(log: FocusLogEntry[]): Promise<FocusLogEntry[]> {
  const fromServer = log.filter(isCreditEntry);
  if (fromServer.length > 0) await mergeCredit(fromServer);
  return log.filter(e => !isCreditEntry(e));
}

async function mergeCredit(entries: FocusLogEntry[]): Promise<boolean> {
  const current = await loadLockInCredit();
  const byId = new Map(current.map(e => [e.sessionId as string, e]));
  let changed = false;
  for (const e of entries) {
    const id = e.sessionId as string;
    const old = byId.get(id);
    if (!old || e.mins > old.mins + 1e-6) { byId.set(id, e); changed = true; }
  }
  if (changed) await saveCredit([...byId.values()]);
  return changed;
}

/** Works out the credit earned so far by the Lock In saved on this phone and
 *  stores it. Returns true when something new was added. */
export async function updateLockInCredit(): Promise<boolean> {
  const local = await loadLocalChallenge().catch(() => null);
  if (!local || local.startAtMs === null) return false;
  // Left early or still in the lobby: nothing more is earned.
  if (local.status !== 'active' && local.status !== 'done') return false;
  const now = serverNow();
  const end = local.endAtMs ?? local.startAtMs + local.days * 86_400_000;
  const bound = Math.min(now, end);
  if (bound <= local.startAtMs) return false;

  const perMs = CREDIT_MINS_PER_DAY / 86_400_000;
  const entries: FocusLogEntry[] = [];
  let cursor = local.startAtMs;
  while (cursor < bound && entries.length < 12) {
    const midnight = new Date(cursor);
    midnight.setHours(24, 0, 0, 0);
    const segEnd = Math.min(midnight.getTime(), bound);
    const day = new Date(cursor);
    const stamp = `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`;
    entries.push({
      date: day.toDateString(),
      mins: (segEnd - cursor) * perMs,
      timestamp: new Date(cursor).toISOString(),
      sessionId: `${PREFIX}${local.id}-${stamp}`,
    });
    cursor = segEnd;
  }
  return mergeCredit(entries);
}
