// Delete account (required by Google Play for any app with sign-up).
// Deletes the account on the server (which removes the profile, friends,
// challenge memberships and stats), then wipes this device the same way
// logging out does.

import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { StorageService } from './storage';
import { saveFocusLog, saveBestFlameMins } from './focusLog';
import { saveDistractionLog } from './distractionLog';
import { clearActiveSession } from './activeFocusSession';
import { stopAppBlocking } from './appBlocking';
import { clearLocalChallenge, cancelChallengeNotifications } from './challenge';
import { PRIVACY_POLICY_URL, ACCOUNT_DELETION_URL } from '../constants/links';
import { BLOCKED_APPS_STORAGE_KEY } from '../data/blockableApps';
import { clearPermissionConsent } from './permissionConsent';
import { tintAlert } from './dialog';

// Whatever else TINT saved under its own names (last-shown dates, wording
// choices, clock offset, ...) and any saved login session, so nothing of the
// deleted account is left on the phone. Never throws.
async function removeLeftoverKeys(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter(k => k.startsWith('tint_') || k.startsWith('sb-'));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
  } catch {}
}

/** What logging out must also remove, beyond the profile and logs: the saved
 *  7 Day Lock In (otherwise the next app open re-arms blocking for a phone
 *  nobody is signed in on, and the next account inherits it), its reminders,
 *  the picked focus apps, and the agreement to the permission screens (so the
 *  next account on this phone is shown them again). The challenge itself stays
 *  on the server, so signing back in restores it. Never throws. */
export async function clearLeftoversOnLogout(): Promise<void> {
  await Promise.all([
    clearLocalChallenge(),
    cancelChallengeNotifications(),
    AsyncStorage.removeItem(BLOCKED_APPS_STORAGE_KEY).catch(() => {}),
    clearPermissionConsent(),
  ]).catch(() => {});
}

export async function wipeThisDevice(): Promise<void> {
  stopAppBlocking();
  await Promise.all([
    StorageService.clearAllUserData(),
    saveFocusLog([]),
    saveDistractionLog([]),
    saveBestFlameMins(0),
    clearActiveSession(),
    clearLocalChallenge(),
    cancelChallengeNotifications(),
    // The apps picked for focus-session blocking.
    AsyncStorage.removeItem(BLOCKED_APPS_STORAGE_KEY).catch(() => {}),
    // The deleted account's agreement to the permission screens.
    clearPermissionConsent(),
  ]);
  await removeLeftoverKeys();
}

/** Deletes the signed-in account. Throws with a readable message on failure. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    throw new Error(
      error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network')
        ? 'No connection. Check your internet and try again.'
        : error.message,
    );
  }
  supabase.auth.signOut().catch(() => {});
  await wipeThisDevice();
}

/** Two-step confirm, then delete. Calls onDeleted once it's gone. */
export function confirmDeleteAccount(onDeleted: () => void): void {
  tintAlert(
    'Delete your account?',
    'This permanently deletes your TINT account and everything in it: your profile, streaks, focus history, friends and challenges. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () => tintAlert(
          'Are you sure?',
          'Your account will be deleted right now.',
          [
            { text: 'Keep my account', style: 'cancel' },
            {
              text: 'Delete forever',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteMyAccount();
                  onDeleted();
                } catch (err) {
                  // Offer the web page too, so a failed delete is never a dead end.
                  tintAlert("Couldn't delete your account", (err as Error).message, [
                    { text: 'OK', style: 'cancel' },
                    { text: 'Other ways to delete', onPress: openAccountDeletionPage },
                  ]);
                }
              },
            },
          ],
        ),
      },
    ],
  );
}

/** The web page that explains how to delete an account without the app. */
export function openAccountDeletionPage(): void {
  Linking.openURL(ACCOUNT_DELETION_URL).catch(() => {});
}

export function openPrivacyPolicy(): void {
  if (!PRIVACY_POLICY_URL) {
    tintAlert('Privacy policy', 'The privacy policy page is not available yet.');
    return;
  }
  Linking.openURL(PRIVACY_POLICY_URL).catch(() => {});
}
