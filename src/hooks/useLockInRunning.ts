import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { LocalChallenge, isLockInRunning, loadLocalChallenge } from '../utils/challenge';

/** The 7 Day Lock In running on this phone right now, or null. Rechecked when
 *  the screen opens, when the app comes back to the front, and every 30
 *  seconds, so it switches on when a Lock In starts and off when it ends. */
export function useLockInRunning(enabled = true): LocalChallenge | null {
  const [running, setRunning] = useState<LocalChallenge | null>(null);
  const refresh = useCallback(async () => {
    const local = await loadLocalChallenge().catch(() => null);
    setRunning(isLockInRunning(local) ? local : null);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void refresh(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [enabled, refresh]);
  return running;
}
