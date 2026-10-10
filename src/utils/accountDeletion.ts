// Delete account (required by Google Play for any app with sign-up).
// Deletes the account on the server (which removes the profile, friends,
// challenge memberships and stats), then wipes this device the same way
// logging out does.

import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { StorageService } from './storage';
import { saveFocusLog, saveBestFlameMins } from './focusLog';
import { saveDistractionLog } from './distractionLog';
import { clearActiveSession } from './activeFocusSession';
import { stopAppBlocking } from './appBlocking';
import { clearLocalChallenge, cancelChallengeNotifications } from './challenge';
import { PRIVACY_POLICY_URL } from '../constants/links';
import { BLOCKED_APPS_STORAGE_KEY } from '../data/blockableApps';

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
  ]);
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
  Alert.alert(
    'Delete your account?',
    'This permanently deletes your TINT account and everything in it: your profile, streaks, focus history, friends and challenges. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () => Alert.alert(
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
                  Alert.alert("Couldn't delete your account", (err as Error).message);
                }
              },
            },
          ],
        ),
      },
    ],
  );
}

export function openPrivacyPolicy(): void {
  if (!PRIVACY_POLICY_URL) {
    Alert.alert('Privacy policy', 'The privacy policy page is not available yet.');
    return;
  }
  Linking.openURL(PRIVACY_POLICY_URL).catch(() => {});
}
