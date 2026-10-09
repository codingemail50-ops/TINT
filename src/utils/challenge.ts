// 7 Day Lock In: everything the challenge screens need that isn't UI.
//
//  - Server (Supabase): the challenge, its 6-letter code, who's in the
//    squad, quits, check-ins, and per-day stats. All writes go through the
//    functions in supabase/migrations/20261009_challenge.sql.
//  - Phone: a small local copy (so blocking can be re-armed with no
//    network), the always-on native blocker, the per-day "blocked app
//    opened" counts, and the scheduled morning/evening notifications.
//
// Times from the server are converted with a clock offset so a wrong phone
// clock can't shorten or skip the challenge.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { packageNamesFor } from '../data/blockableApps';
import { DAY_NOTIFICATIONS } from '../data/challengeMessages';
import {
  startChallengeAppBlocking, stopAppBlocking, emergencyPauseBlocking,
  getChallengeBlockStats, getUsageSummary,
} from './appBlocking';
import { ensureNotificationPermission } from './sessionNotifications';

export const CHALLENGE_DAYS = 7;
export const MAX_SQUAD = 6;
export const EMERGENCY_LIMIT = 2;
export const EMERGENCY_MS = 5 * 60_000;
export const CHALLENGE_TITLE = '7 Day Lock In';
export const DEFAULT_CHALLENGE_APPS = ['instagram', 'youtube', 'snapchat', 'facebook'];

const DAY_MS = 86_400_000;
const LOCAL_KEY = 'tint_challenge_local';
const NOTIFICATION_PREFIX = 'tint-challenge-';
const WIN_VARIANT_KEY = 'tint_lockin_win_variant_';

export type ChallengeMode = 'solo' | 'squad';
export type LocalStatus = 'lobby' | 'active' | 'quit' | 'done';

export interface ChallengeRow {
  id: string;
  code: string;
  creator_id: string;
  mode: ChallengeMode;
  status: 'lobby' | 'active';
  days: number;
  start_at: string | null;
  created_at: string;
}

export interface MemberRow {
  challenge_id: string;
  user_id: string;
  name: string;
  avatar: string;
  apps: string[];
  status: 'active' | 'quit';
  joined_at: string;
  quit_at: string | null;
  last_seen_at: string | null;
  emergency_used: number;
  baseline: UsageSnapshot | null;
  report: unknown;
}

export interface UsageSnapshot {
  fromMs: number;
  toMs: number;
  apps: Record<string, { opens: number; foregroundMs: number }>;
}

/** Phone-side copy of the challenge. Times are server-clock ms. */
export interface LocalChallenge {
  id: string;
  code: string;
  mode: ChallengeMode;
  isCreator: boolean;
  status: LocalStatus;
  days: number;
  startAtMs: number | null;
  endAtMs: number | null;
  /** Blockable app ids (see data/blockableApps). */
  apps: string[];
  emergencyUsed: number;
  emergencyUntilMs: number;
  baselineSaved: boolean;
  notificationsScheduled: boolean;
  quitDay: number | null;
}

// ── clock ───────────────────────────────────────────────────────────────

let clockOffsetMs = 0;

/** Server time minus phone time, refreshed from the server when possible. */
export async function syncServerClock(): Promise<void> {
  try {
    const before = Date.now();
    const { data, error } = await supabase.rpc('server_now');
    if (error || !data) return;
    const after = Date.now();
    clockOffsetMs = Date.parse(data as string) - (before + after) / 2;
    await AsyncStorage.setItem(LOCAL_KEY + '_offset', String(clockOffsetMs));
  } catch {
    // Offline: keep the last known offset.
  }
}

async function loadClockOffset(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY + '_offset');
    if (raw) clockOffsetMs = Number(raw) || 0;
  } catch {}
}

export function serverNow(): number {
  return Date.now() + clockOffsetMs;
}

/** Server-clock ms to this phone's clock (what the native blocker uses). */
function toPhoneMs(serverMs: number): number {
  return serverMs - clockOffsetMs;
}

// ── local copy ──────────────────────────────────────────────────────────

export async function loadLocalChallenge(): Promise<LocalChallenge | null> {
  await loadClockOffset();
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const local = JSON.parse(raw) as LocalChallenge;
    // Finished while offline: the phone's own copy has to notice too.
    if (local.status === 'active' && local.endAtMs !== null && serverNow() >= local.endAtMs) {
      local.status = 'done';
    }
    return local;
  } catch {
    return null;
  }
}

export async function saveLocalChallenge(local: LocalChallenge): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(local));
  } catch {}
}

export async function clearLocalChallenge(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOCAL_KEY);
  } catch {}
}

// ── derived numbers ─────────────────────────────────────────────────────

export function hasStarted(local: LocalChallenge, now = serverNow()): boolean {
  return local.startAtMs !== null && now >= local.startAtMs;
}

/** 1..days while running; 0 before the start. */
export function dayNumber(local: LocalChallenge, now = serverNow()): number {
  if (local.startAtMs === null || now < local.startAtMs) return 0;
  return Math.min(local.days, Math.floor((now - local.startAtMs) / DAY_MS) + 1);
}

/** Fraction of the whole challenge done, 0..1. */
export function progressFraction(local: LocalChallenge, now = serverNow()): number {
  if (local.startAtMs === null || local.endAtMs === null) return 0;
  const total = local.endAtMs - local.startAtMs;
  return Math.min(1, Math.max(0, (now - local.startAtMs) / total));
}

/** Full days completed (the streak). */
export function daysCompleted(local: LocalChallenge, now = serverNow()): number {
  if (local.startAtMs === null) return 0;
  return Math.min(local.days, Math.max(0, Math.floor((now - local.startAtMs) / DAY_MS)));
}

export function formatTimeLeft(ms: number, short = false): string {
  const safe = Math.max(0, ms);
  const days = Math.floor(safe / DAY_MS);
  const hours = Math.floor((safe % DAY_MS) / 3_600_000);
  const mins = Math.floor((safe % 3_600_000) / 60_000);
  if (days > 0) return short ? `${days}d ${hours}h` : `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ── server ──────────────────────────────────────────────────────────────

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** Turns a database error into something a person can read. */
export function challengeErrorMessage(err: unknown): string {
  const raw = (err as { message?: string } | null)?.message ?? String(err ?? '');
  if (raw.includes('already in a challenge')) return "You're already in a challenge.";
  if (raw.includes('code not found')) return 'That code was not found, or that squad already started.';
  if (raw.includes('squad is full')) return 'That squad is full (6 max).';
  if (raw.includes('only the squad creator')) return 'Only the person who made the squad can start it.';
  if (raw.includes('not signed in')) return 'You need to be signed in.';
  if (raw.toLowerCase().includes('network') || raw.toLowerCase().includes('fetch')) {
    return 'No connection. Check your internet and try again.';
  }
  return raw || 'Something went wrong. Try again.';
}

function toLocal(ch: ChallengeRow, member: MemberRow | null, uid: string | null, prev?: LocalChallenge | null): LocalChallenge {
  const startAtMs = ch.start_at ? Date.parse(ch.start_at) : null;
  const endAtMs = startAtMs !== null ? startAtMs + ch.days * DAY_MS : null;
  const same = prev && prev.id === ch.id ? prev : null;
  let status: LocalStatus = ch.status === 'lobby' ? 'lobby' : 'active';
  if (member?.status === 'quit') status = 'quit';
  else if (status === 'active' && endAtMs !== null && serverNow() >= endAtMs) status = 'done';
  return {
    id: ch.id,
    code: ch.code,
    mode: ch.mode,
    isCreator: !!uid && ch.creator_id === uid,
    status,
    days: ch.days,
    startAtMs,
    endAtMs,
    apps: member?.apps ?? same?.apps ?? [],
    emergencyUsed: Math.max(member?.emergency_used ?? 0, same?.emergencyUsed ?? 0),
    emergencyUntilMs: same?.emergencyUntilMs ?? 0,
    baselineSaved: !!member?.baseline || !!same?.baselineSaved,
    notificationsScheduled: same?.notificationsScheduled ?? false,
    quitDay: same?.quitDay ?? null,
  };
}

export async function createChallenge(mode: ChallengeMode, apps: string[], startAtMs: number | null): Promise<LocalChallenge> {
  const { data, error } = await supabase.rpc('create_challenge', {
    p_mode: mode,
    p_apps: apps,
    p_start_at: startAtMs !== null ? new Date(startAtMs).toISOString() : null,
  });
  if (error) throw error;
  const uid = await currentUserId();
  const local = toLocal(data as ChallengeRow, null, uid);
  local.apps = apps;
  await saveLocalChallenge(local);
  return local;
}

export async function joinChallenge(code: string, apps: string[]): Promise<LocalChallenge> {
  const { data, error } = await supabase.rpc('join_challenge', { p_code: code, p_apps: apps });
  if (error) throw error;
  const uid = await currentUserId();
  const local = toLocal(data as ChallengeRow, null, uid);
  local.apps = apps;
  await saveLocalChallenge(local);
  return local;
}

export async function startSquad(id: string): Promise<void> {
  const { error } = await supabase.rpc('start_challenge', { p_id: id });
  if (error) throw error;
}

export async function leaveLobby(id: string): Promise<void> {
  const { error } = await supabase.rpc('leave_lobby', { p_id: id });
  if (error) throw error;
  await clearLocalChallenge();
}

export async function fetchMembers(id: string): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from('challenge_members')
    .select('*')
    .eq('challenge_id', id)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MemberRow[];
}

/** Re-reads the challenge from the server and merges it into the local
 *  copy. Returns null if this account isn't in it any more (e.g. the squad
 *  lobby was closed by its creator). Throws on network errors. */
export async function refreshChallenge(prev: LocalChallenge): Promise<LocalChallenge | null> {
  const uid = await currentUserId();
  const { data, error } = await supabase.from('challenges').select('*').eq('id', prev.id).maybeSingle();
  if (error) throw error;
  if (!data) {
    await clearLocalChallenge();
    return null;
  }
  const members = await fetchMembers(prev.id);
  const me = members.find(m => m.user_id === uid) ?? null;
  if (!me) {
    await clearLocalChallenge();
    return null;
  }
  const local = toLocal(data as ChallengeRow, me, uid, prev);
  await saveLocalChallenge(local);
  return local;
}

/** The newest challenge this account is part of, if any (used after a
 *  reinstall or on another phone). */
export async function fetchMyLatestChallenge(): Promise<LocalChallenge | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('challenge_members')
    .select('*, challenges(*)')
    .eq('user_id', uid)
    .order('joined_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0] as (MemberRow & { challenges: ChallengeRow | null }) | undefined;
  if (!row || !row.challenges) return null;
  const prev = await loadLocalChallenge();
  const local = toLocal(row.challenges, row, uid, prev);
  await saveLocalChallenge(local);
  return local;
}

export async function touchChallenge(id: string): Promise<void> {
  try {
    await supabase.rpc('touch_challenge', { p_id: id });
  } catch {}
}

export async function quitChallenge(local: LocalChallenge): Promise<LocalChallenge> {
  const { error } = await supabase.rpc('quit_challenge', { p_id: local.id });
  if (error) throw error;
  stopAppBlocking();
  await cancelChallengeNotifications();
  const next: LocalChallenge = { ...local, status: 'quit', quitDay: dayNumber(local) };
  await saveLocalChallenge(next);
  return next;
}

// ── blocking ────────────────────────────────────────────────────────────

/** Starts (or re-arms) always-on blocking for a running challenge. Safe to
 *  call on every app open. Does nothing for a lobby or a finished one. */
export function armChallengeBlocking(local: LocalChallenge): void {
  if (local.status !== 'active' || local.startAtMs === null || local.endAtMs === null) return;
  if (serverNow() >= local.endAtMs) return;
  const startPhone = hasStarted(local) ? 0 : toPhoneMs(local.startAtMs);
  startChallengeAppBlocking(packageNamesFor(local.apps), startPhone, toPhoneMs(local.endAtMs), CHALLENGE_TITLE);
}

export async function triggerEmergency(local: LocalChallenge): Promise<LocalChallenge> {
  if (local.emergencyUsed >= EMERGENCY_LIMIT) return local;
  emergencyPauseBlocking(EMERGENCY_MS);
  const next: LocalChallenge = {
    ...local,
    emergencyUsed: local.emergencyUsed + 1,
    emergencyUntilMs: serverNow() + EMERGENCY_MS,
  };
  await saveLocalChallenge(next);
  try {
    await supabase.rpc('save_challenge_member_data', { p_id: local.id, p_emergency_used: next.emergencyUsed });
  } catch {}
  return next;
}

// ── stats ───────────────────────────────────────────────────────────────

function dayKey(phoneMs: number): string {
  const d = new Date(phoneMs);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${mm}${dd}`;
}

/** This challenge's per-day blocked-open counts, keyed yyyyMMdd. */
export function challengeDayStats(local: LocalChallenge): Record<string, Record<string, number>> {
  if (local.startAtMs === null || local.endAtMs === null) return {};
  const first = dayKey(toPhoneMs(local.startAtMs));
  const last = dayKey(toPhoneMs(local.endAtMs));
  const all = getChallengeBlockStats();
  const out: Record<string, Record<string, number>> = {};
  for (const [day, perApp] of Object.entries(all)) {
    if (day >= first && day <= last) out[day] = perApp;
  }
  return out;
}

function sum(perApp: Record<string, number> | undefined): number {
  return Object.values(perApp ?? {}).reduce((a, b) => a + b, 0);
}

export function urgesToday(local: LocalChallenge): number {
  return sum(challengeDayStats(local)[dayKey(Date.now())]);
}

export function urgesTotal(local: LocalChallenge): number {
  return Object.values(challengeDayStats(local)).reduce((a, perApp) => a + sum(perApp), 0);
}

/** Per-app totals across the whole challenge, by package name. */
export function urgesByApp(local: LocalChallenge): Record<string, number> {
  const out: Record<string, number> = {};
  for (const perApp of Object.values(challengeDayStats(local))) {
    for (const [pkg, n] of Object.entries(perApp)) out[pkg] = (out[pkg] ?? 0) + n;
  }
  return out;
}

/** Uploads this challenge's per-day counts. Best-effort. */
export async function uploadChallengeStats(local: LocalChallenge): Promise<void> {
  const days = challengeDayStats(local);
  for (const [day, perApp] of Object.entries(days)) {
    try {
      await supabase.rpc('upload_day_stats', { p_id: local.id, p_day: day, p_opens: sum(perApp), p_per_app: perApp });
    } catch {}
  }
}

/** The "before" picture: real use of the blocked apps in the week before
 *  the start. Android only keeps about a week of history, so this has to
 *  be taken at the start. Saved once, on the server, so it survives
 *  a reinstall. */
export async function saveBaselineIfNeeded(local: LocalChallenge): Promise<LocalChallenge> {
  if (local.baselineSaved || local.startAtMs === null) return local;
  const toPhone = Math.min(Date.now(), toPhoneMs(local.startAtMs));
  const fromPhone = toPhone - CHALLENGE_DAYS * DAY_MS;
  const snapshot: UsageSnapshot = {
    fromMs: fromPhone,
    toMs: toPhone,
    apps: getUsageSummary(packageNamesFor(local.apps), fromPhone, toPhone),
  };
  try {
    const { error } = await supabase.rpc('save_challenge_member_data', { p_id: local.id, p_baseline: snapshot });
    if (error) return local;
  } catch {
    return local;
  }
  const next = { ...local, baselineSaved: true };
  await saveLocalChallenge(next);
  return next;
}

export async function fetchMyBaseline(local: LocalChallenge): Promise<UsageSnapshot | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  try {
    const { data } = await supabase
      .from('challenge_members')
      .select('baseline')
      .eq('challenge_id', local.id)
      .eq('user_id', uid)
      .maybeSingle();
    return (data?.baseline as UsageSnapshot | null) ?? null;
  } catch {
    return null;
  }
}

export interface ChallengeReport {
  urgesResisted: number;
  urgesByApp: Record<string, number>;
  emergencyUsed: number;
  before: UsageSnapshot | null;
  completedAtMs: number;
}

export async function saveReport(local: LocalChallenge, report: ChallengeReport): Promise<void> {
  try {
    await supabase.rpc('save_challenge_member_data', { p_id: local.id, p_report: report });
  } catch {}
}

/** Which completion-screen wording this person gets, 0..count-1. Picked
 *  once and then kept: from their account id when there is one (so it's the
 *  same after a reinstall, and spread evenly across people), else at random.
 *  Saved on the phone either way. */
export async function getWinVariant(count: number): Promise<number> {
  const uid = await currentUserId();
  const key = WIN_VARIANT_KEY + (uid ?? 'anon');
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw !== null) {
      const saved = Number(raw);
      if (Number.isInteger(saved) && saved >= 0 && saved < count) return saved;
    }
  } catch {}
  let picked: number;
  if (uid) {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
    picked = h % count;
  } else {
    picked = Math.floor(Math.random() * count);
  }
  try {
    await AsyncStorage.setItem(key, String(picked));
  } catch {}
  return picked;
}

// ── notifications ───────────────────────────────────────────────────────

export async function cancelChallengeNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => n.identifier.startsWith(NOTIFICATION_PREFIX))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch {}
}

/** Morning (9 AM) and evening (9 PM) messages for each day, plus one at
 *  the finish. Replaces any already scheduled. */
export async function scheduleChallengeNotifications(local: LocalChallenge): Promise<LocalChallenge> {
  if (Platform.OS === 'web' || local.startAtMs === null || local.endAtMs === null) return local;
  await ensureNotificationPermission();
  await cancelChallengeNotifications();
  const startPhone = toPhoneMs(local.startAtMs);
  const endPhone = toPhoneMs(local.endAtMs);
  const nowPhone = Date.now();
  const jobs: Promise<unknown>[] = [];
  for (let day = 1; day <= local.days; day++) {
    const dayStart = new Date(startPhone + (day - 1) * DAY_MS);
    for (const [slot, hour] of [['am', 9], ['pm', 21]] as const) {
      const at = new Date(dayStart);
      at.setHours(hour, 0, 0, 0);
      const t = at.getTime();
      if (t <= nowPhone || t <= startPhone || t >= endPhone) continue;
      const copy = DAY_NOTIFICATIONS[day][slot];
      jobs.push(Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_PREFIX}${day}-${slot}`,
        content: { title: copy.title, body: copy.body, sound: false },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      }));
    }
  }
  if (endPhone > nowPhone) {
    jobs.push(Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_PREFIX}done`,
      content: { title: 'You did it. 7 days locked in.', body: 'Open TINT to see your week.', sound: false },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endPhone) },
    }));
  }
  try {
    await Promise.all(jobs);
  } catch {
    return local;
  }
  const next = { ...local, notificationsScheduled: true };
  await saveLocalChallenge(next);
  return next;
}

/** Everything that should happen once a challenge is running: blocking,
 *  the before-snapshot, notifications. Safe to call repeatedly. */
export async function onChallengeRunning(local: LocalChallenge): Promise<LocalChallenge> {
  armChallengeBlocking(local);
  let next = await saveBaselineIfNeeded(local);
  if (!next.notificationsScheduled) next = await scheduleChallengeNotifications(next);
  return next;
}
