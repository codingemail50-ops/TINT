import AsyncStorage from '@react-native-async-storage/async-storage';

// Dev-only "what day is it" override so the streak/heatmap/Insights logic
// can be tested a day (or several) ahead without waiting on the real clock.
// Every date-dependent read in the app that feeds those screens goes
// through now() instead of `new Date()` directly — everything else (auth,
// timestamps, focus-session wall-clock math) intentionally still uses the
// real clock, since faking those would make session timing lie to itself.
let offsetMs = 0;
let loaded = false;
const KEY = 'tint_dev_day_offset';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to be notified after the dev offset changes (advance/reset),
 *  so an already-mounted screen (they stay mounted across tab switches —
 *  see AppNavigator) can refetch its date-dependent data. Returns an
 *  unsubscribe function, meant to be returned directly from a useEffect. */
export function subscribeDevClock(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const l of listeners) l();
}

export function now(): Date {
  return new Date(Date.now() + offsetMs);
}

export async function loadDevOffset(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) offsetMs = Number(raw) || 0;
  } catch {}
}

export async function advanceDevDay(days = 1): Promise<void> {
  offsetMs += days * 86400000;
  try { await AsyncStorage.setItem(KEY, String(offsetMs)); } catch {}
  notify();
}

export async function resetDevOffset(): Promise<void> {
  offsetMs = 0;
  try { await AsyncStorage.setItem(KEY, '0'); } catch {}
  notify();
}

export function getDevDayOffset(): number {
  return Math.round(offsetMs / 86400000);
}
