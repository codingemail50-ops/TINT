import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOTIVATIONAL_MESSAGES, MotivationalMessage } from '../data/motivationalMessages';
import { now as devNow } from './devClock';

const LAST_SHOWN_KEY = 'tint_motivation_last_shown';

interface LastShown {
  dateKey: string;
  index: number;
  /** Positions already shown in the current round (see below). */
  seen?: number[];
}

async function readLastShown(): Promise<LastShown | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Once per calendar day, picked at random. Every message is shown once before
// any comes round again (a new round then starts), and the same message is
// never shown on two days in a row. Returns null once today's message has
// already been shown. A fresh install starts at a random message too, not
// always the first.
export async function getTodaysMotivationalMessage(): Promise<MotivationalMessage | null> {
  const todayKey = devNow().toDateString();
  const last = await readLastShown();
  if (last?.dateKey === todayKey) return null;

  const total = MOTIVATIONAL_MESSAGES.length;
  let seen = Array.isArray(last?.seen) ? last!.seen!.filter(i => Number.isInteger(i) && i >= 0 && i < total) : [];
  if (seen.length >= total) seen = [];
  let pool = Array.from({ length: total }, (_, i) => i).filter(i => !seen.includes(i));
  if (pool.length > 1 && last && typeof last.index === 'number') pool = pool.filter(i => i !== last.index);
  const nextIndex = pool[Math.floor(Math.random() * pool.length)];
  try {
    await AsyncStorage.setItem(LAST_SHOWN_KEY, JSON.stringify({ dateKey: todayKey, index: nextIndex, seen: [...seen, nextIndex] }));
  } catch {}
  return MOTIVATIONAL_MESSAGES[nextIndex];
}

export interface MessageSegment {
  text: string;
  highlight: boolean;
}

// Splits a `{{...}}` template into plain/highlight segments for rendering —
// the literal `{{GOAL}}` token is substituted with the user's own goal text
// (falling back to "your goal") rather than rendered as-is.
export function parseMotivationalTemplate(template: string, goalText: string | null): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const regex = /\{\{(.*?)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: template.slice(lastIndex, match.index), highlight: false });
    }
    const raw = match[1];
    segments.push({ text: raw === 'GOAL' ? (goalText || 'your goal') : raw, highlight: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < template.length) {
    segments.push({ text: template.slice(lastIndex), highlight: false });
  }
  return segments;
}
