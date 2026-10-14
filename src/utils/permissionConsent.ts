// Remembers, on this phone only, that the user has read why TINT needs the
// two blocking permissions (Usage access, Display over other apps) and
// agreed.
//   - The short popup is remembered PER PERMISSION: the first time someone taps
//     Allow, Grant or the toggle for Usage access it shows, and the first time
//     they do the same for Display over other apps it shows again. It never
//     repeats for a permission they have already agreed to.
//   - The longer 7 Day Lock In screen (what is saved to the account, squad
//     visibility) has its own flag.
// They are all separate: agreeing on one does not skip another.
//
// Every read and write is wrapped: storage failing must never break the
// screen, it just means the user is asked again.

import AsyncStorage from '@react-native-async-storage/async-storage';

export type ConsentPermission = 'usageAccess' | 'overlay';
const POPUP_KEYS: Record<ConsentPermission, string> = {
  usageAccess: 'tint_permission_consent_usage_v1',
  overlay: 'tint_permission_consent_overlay_v1',
};
// The single popup flag from the first version, removed with the rest on delete.
const OLD_POPUP_KEY = 'tint_permission_consent_v1';
// Same key the Lock In screen has always used, so people who already agreed
// there are not asked that screen again.
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

/** True once the user has agreed on the popup for this permission. */
export async function hasPermissionConsent(permission: ConsentPermission): Promise<boolean> {
  return read(POPUP_KEYS[permission]);
}

export async function setPermissionConsent(permission: ConsentPermission): Promise<void> {
  await write(POPUP_KEYS[permission]);
}

/** True only if the user has agreed on the 7 Day Lock In screen itself. */
export async function hasLockInConsent(): Promise<boolean> {
  return read(LOCKIN_KEY);
}

export async function setLockInConsent(): Promise<void> {
  await write(LOCKIN_KEY);
}

/** Called when the account is deleted (not on logout, so a returning user
 *  is not asked again). */
export async function clearPermissionConsent(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...Object.values(POPUP_KEYS), OLD_POPUP_KEY, LOCKIN_KEY]);
  } catch {}
}
