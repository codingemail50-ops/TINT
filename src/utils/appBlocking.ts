// Permission-request/redirect plumbing for real app blocking.
//
// IMPORTANT — what this file does NOT do: actually intercept app launches
// or draw a block screen over another app. That requires a custom native
// Android module (an AccessibilityService, or a foreground service paired
// with UsageStatsManager polling) that does not exist in Expo Go and can't
// be built or tested without ejecting to a custom EAS dev client. This
// file only handles the permission-grant redirect + a self-reported
// "did you grant it" flag, so the UI has something real to do today.
//
// Play Store policy risk, worth knowing before building the native module:
// Google scrutinizes AccessibilityService usage heavily and has removed
// "focus"/app-blocking apps for using it without a narrow, well-justified
// accessibility purpose. UsageStatsManager (Usage Access) + a foreground
// service that polls the current foreground app every few seconds is the
// safer, more commonly-accepted path for this kind of feature, at the
// cost of blocking being "checked every few seconds" rather than instant.
// Decide which tradeoff to take before writing the native module.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';

// Matches app.json's android.package — used for the overlay-permission
// intent, which needs a package-specific URI to jump straight to this
// app's toggle instead of a generic settings list.
const ANDROID_PACKAGE_NAME = 'com.tint.app';

const GRANTED_KEY = 'tint_permission_self_reported';

export type BlockingPermission = 'usageAccess' | 'accessibility' | 'overlay';

export async function openPermissionSettings(permission: BlockingPermission): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('App-blocking permissions are Android-only — iOS uses the separate Screen Time / FamilyControls API.');
  }
  switch (permission) {
    case 'usageAccess':
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.USAGE_ACCESS_SETTINGS);
      break;
    case 'accessibility':
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.ACCESSIBILITY_SETTINGS);
      break;
    case 'overlay':
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.MANAGE_OVERLAY_PERMISSION, {
        data: `package:${ANDROID_PACKAGE_NAME}`,
      });
      break;
  }
}

// Self-reported only — there is no JS-reachable API to actually verify
// these without the native module mentioned above. Treat this as "the
// user says they did it," not a real permission check.
export async function getSelfReportedGrants(): Promise<Record<BlockingPermission, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(GRANTED_KEY);
    return raw ? JSON.parse(raw) : { usageAccess: false, accessibility: false, overlay: false };
  } catch {
    return { usageAccess: false, accessibility: false, overlay: false };
  }
}

export async function setSelfReportedGrant(permission: BlockingPermission, granted: boolean): Promise<void> {
  const current = await getSelfReportedGrants();
  current[permission] = granted;
  await AsyncStorage.setItem(GRANTED_KEY, JSON.stringify(current));
}
