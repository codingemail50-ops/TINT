// Local (device-only) notification fired when a focus session finishes
// while TINT is backgrounded — no push infra, no server involvement.
// expo-notifications is an official Expo SDK package (unlike the Google
// Sign-In package) and is safe to import statically: it degrades itself
// gracefully on web/Expo Go rather than throwing at import time.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let handlerConfigured = false;
function ensureHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

let permissionRequested = false;

/** Requests notification permission once per app run — call on first
 *  focus-session start (not app launch), so the OS prompt appears with
 *  clear context for why TINT wants it. */
export async function ensureNotificationPermission(): Promise<void> {
  if (Platform.OS === 'web') return;
  ensureHandler();
  if (permissionRequested) return;
  permissionRequested = true;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    // Not available in this environment — fail quiet, the session itself
    // doesn't depend on this.
  }
}

/** Fires immediately (trigger: null = "now"). Callers are expected to only
 *  invoke this when the app is backgrounded — the in-app "Session
 *  Complete" screen already covers the foregrounded case. */
export async function notifySessionComplete(durationMins: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Focus session complete',
        body: `${durationMins} minute${durationMins === 1 ? '' : 's'} of focus — nice work.`,
        sound: false,
      },
      trigger: null,
    });
  } catch {
    // Best-effort — never let a notification failure affect session logging.
  }
}
