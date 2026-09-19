import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOTIVATIONAL_MESSAGES, MotivationalMessage } from '../data/motivationalMessages';
import { now as devNow } from './devClock';

const LAST_SHOWN_KEY = 'tint_motivation_last_shown';

interface LastShown {
  dateKey: string;
  index: number;
}

async function readLastShown(): Promise<LastShown | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Once per calendar day: walks the content bank in order (wrapping back to
// the start), so the whole set surfaces before anything repeats, instead of
// picking randomly and risking the same line twice in a row. Returns null
// once today's message has already been shown.
export async function getTodaysMotivationalMessage(): Promise<MotivationalMessage | null> {
  const todayKey = devNow().toDateString();
  const last = await readLastShown();
  if (last?.dateKey === todayKey) return null;

  const nextIndex = last ? (last.index + 1) % MOTIVATIONAL_MESSAGES.length : 0;
  try {
    await AsyncStorage.setItem(LAST_SHOWN_KEY, JSON.stringify({ dateKey: todayKey, index: nextIndex }));
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
