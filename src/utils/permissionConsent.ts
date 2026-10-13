// Remembers, on this phone only, that the user has read why TINT needs the
// two blocking permissions (Usage access, Display over other apps) and
// agreed. Two flags:
//   - SHARED: the short popup shown before Android Settings opens from the
//     sign-up goal screen or the Focus tab.
//   - LOCKIN: the longer 7 Day Lock In screen, which says everything the
//     popup says and more (what is saved to the account, squad visibility).
// Agreeing on the Lock In screen counts for the popup too; agreeing on the
// popup does NOT skip the Lock In screen.
//
// Every read and write is wrapped: storage failing must never break the
// screen, it just means the user is asked again.

import AsyncStorage from '@react-native-async-storage/async-storage';

const SHARED_KEY = 'tint_permission_consent_v1';
// Same key the Lock In screen has always used, so people who already agreed
// there are not asked again.
const LOCKIN_KEY = 'tint_lockin_consent_v1';

async function read(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === 'yes';
  } catch {
    return false;
  }
}

async function write(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, 'yes');
  } catch {}
}

/** True if the user has agreed on the popup or on the Lock In screen. */
export async function hasPermissionConsent(): Promise<boolean> {
  return (await read(SHARED_KEY)) || (await read(LOCKIN_KEY));
}

export async function setPermissionConsent(): Promise<void> {
  await write(SHARED_KEY);
}

/** True only if the user has agreed on the 7 Day Lock In screen itself. */
export async function hasLockInConsent(): Promise<boolean> {
  return read(LOCKIN_KEY);
}

/** Agreeing on the Lock In screen also covers the popup. */
export async function setLockInConsent(): Promise<void> {
  await write(LOCKIN_KEY);
  await write(SHARED_KEY);
}

/** Called when the account is deleted (not on logout, so a returning user
 *  is not asked again). */
export async function clearPermissionConsent(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([SHARED_KEY, LOCKIN_KEY]);
  } catch {}
}
