import AsyncStorage from '@react-native-async-storage/async-storage';

// Persisted descriptor for whichever focus session is currently running —
// written on start, cleared on finish/exit. Lets a session survive the OS
// killing the backgrounded app (in-memory React state can't survive that;
// this can, since it's read back on the next cold boot). Not needed for
// ordinary tab-switching inside the app — that's handled by simply not
// unmounting the screens (see AppNavigator) — this is specifically for the
// "app process itself was killed" case.
export interface ActiveFocusSessionDescriptor {
  source: 'tab' | 'task';
  startedAtMs: number;
  durationMins: number;
  title: string;
  /** Only set for task-linked sessions — lets Today re-open the right task's overlay. */
  taskId?: string;
}

const KEY = 'tint_active_focus_session';

export async function saveActiveSession(descriptor: ActiveFocusSessionDescriptor): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(descriptor)); } catch {}
}

export async function loadActiveSession(): Promise<ActiveFocusSessionDescriptor | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function clearActiveSession(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
