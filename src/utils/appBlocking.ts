// Permission-request/redirect plumbing, plus the bridge into the native
// Android module (modules/tint-app-blocker) that runs the real blocker:
// a foreground service polling UsageStatsManager, showing a block overlay
// over selected apps while a focus session is active.
//
// V1 architecture (approved): UsageStatsManager + foreground service +
// WindowManager overlay. Deliberately NOT AccessibilityService, Device
// Admin, or a VPN — see modules/tint-app-blocker's own comments for why
// (Play policy risk for the former, UX mismatch for the latter two).

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import * as TintAppBlocker from 'tint-app-blocker';

// Matches app.json's android.package — used for the overlay-permission
// intent, which needs a package-specific URI to jump straight to this
// app's toggle instead of a generic settings list.
const ANDROID_PACKAGE_NAME = 'com.tint.app';

const GRANTED_KEY = 'tint_permission_self_reported';

export type BlockingPermission = 'usageAccess' | 'overlay';

export async function openPermissionSettings(permission: BlockingPermission): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('App-blocking permissions are Android-only — iOS uses the separate Screen Time / FamilyControls API.');
  }
  switch (permission) {
    case 'usageAccess':
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.USAGE_ACCESS_SETTINGS);
      break;
    case 'overlay':
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.MANAGE_OVERLAY_PERMISSION, {
        data: `package:${ANDROID_PACKAGE_NAME}`,
      });
      break;
  }
}

// Self-reported fallback — only meaningful where the native module isn't
// linked (web preview, Expo Go, iOS). On a real Android build, checkPermission()
// below reports the OS's actual answer instead and this is never consulted.
export async function getSelfReportedGrants(): Promise<Record<BlockingPermission, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(GRANTED_KEY);
    return raw ? JSON.parse(raw) : { usageAccess: false, overlay: false };
  } catch {
    return { usageAccess: false, overlay: false };
  }
}

export async function setSelfReportedGrant(permission: BlockingPermission, granted: boolean): Promise<void> {
  const current = await getSelfReportedGrants();
  current[permission] = granted;
  await AsyncStorage.setItem(GRANTED_KEY, JSON.stringify(current));
}

export function isNativeBlockingAvailable(): boolean {
  return Platform.OS === 'android' && TintAppBlocker.isAvailable();
}

/** Real, OS-reported grant state. Returns null when the native module isn't
 *  linked, so callers know to fall back to the self-reported flag instead
 *  of just reporting "not granted" for a permission that doesn't apply here. */
export function checkPermission(permission: BlockingPermission): boolean | null {
  if (!isNativeBlockingAvailable()) return null;
  return permission === 'usageAccess' ? TintAppBlocker.hasUsageAccess() : TintAppBlocker.hasOverlayPermission();
}

/** Starts (or re-arms, e.g. after an app-kill mid-session) the native
 *  blocker for the given Android package names. No-op off Android or when
 *  the native module isn't linked (Expo Go/web) or when there's nothing to block. */
export function startAppBlocking(packageNames: string[]): void {
  if (!isNativeBlockingAvailable() || packageNames.length === 0) return;
  TintAppBlocker.startBlocking(packageNames);
}

/** Stops polling, removes any visible block overlay, and stops the
 *  foreground service. Safe to call even if blocking was never started. */
export function stopAppBlocking(): void {
  if (!isNativeBlockingAvailable()) return;
  TintAppBlocker.stopBlocking();
}
