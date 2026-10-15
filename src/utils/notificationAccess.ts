// Whether TINT may show notifications, and asking for them.
//
// A 7 Day Lock In needs them: its notification is how the person sees the
// challenge is live and how much time is left. Android 13+ lets people turn
// notifications off, and on every version they can be blocked in Settings.
// Everything here fails open: if the check itself errors, nobody is blocked.

import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';

/** True when TINT is allowed to show notifications. */
export async function notificationsAllowed(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).status === 'granted';
  } catch {
    return true;
  }
}

/** Android's own prompt if it can still be shown, otherwise TINT's page in
 *  Android settings (after two refusals Android stops showing the prompt). */
export async function askForNotifications(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return;
    if (current.canAskAgain) {
      await Notifications.requestPermissionsAsync();
    } else {
      await Linking.openSettings();
    }
  } catch {}
}
