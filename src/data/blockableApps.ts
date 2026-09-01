import { Ionicons } from '@expo/vector-icons';

// Shared catalog of "commonly distracting" apps a user can flag to be
// blocked during a focus session. Used by both the Focus screen's full
// picker sheet and the onboarding goal screen's compact preview — kept in
// one place so the two never drift out of sync on ids/icons/storage key.
export interface BlockableApp {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string; // brand color, used as the chip background
  /** Real Android application id — what the native blocker compares
   *  against UsageStatsManager's foreground-package reports. Not used on
   *  iOS/web, where the native blocker doesn't run. */
  packageName: string;
}

export const BLOCKABLE_APPS: BlockableApp[] = [
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C', packageName: 'com.instagram.android' },
  { id: 'youtube', label: 'YouTube', icon: 'logo-youtube', color: '#FF0000', packageName: 'com.google.android.youtube' },
  { id: 'twitter', label: 'Twitter / X', icon: 'logo-twitter', color: '#1DA1F2', packageName: 'com.twitter.android' },
  { id: 'reddit', label: 'Reddit', icon: 'logo-reddit', color: '#FF4500', packageName: 'com.reddit.frontpage' },
  { id: 'snapchat', label: 'Snapchat', icon: 'logo-snapchat', color: '#FFFC00', packageName: 'com.snapchat.android' },
];

export const DEFAULT_BLOCKED_APPS = ['instagram', 'youtube'];

export const BLOCKED_APPS_STORAGE_KEY = 'tint_blocked_apps';

/** Maps blocked-app ids (as stored in AsyncStorage/state) to the real
 *  Android package names the native blocker needs. Unknown ids are
 *  dropped rather than throwing — storage could in theory hold a stale id
 *  from a removed catalog entry. */
export function packageNamesFor(ids: string[]): string[] {
  return ids
    .map(id => BLOCKABLE_APPS.find(a => a.id === id)?.packageName)
    .filter((pkg): pkg is string => !!pkg);
}
