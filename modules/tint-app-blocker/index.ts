import { requireOptionalNativeModule } from 'expo-modules-core';

// Thin, typed wrapper over the native "TintAppBlocker" module (see
// android/src/main/java/expo/modules/tintappblocker/). Returns null instead
// of throwing when the module isn't linked — true in Expo Go, web, and iOS,
// where every function below just becomes a safe no-op.
type TintAppBlockerNativeModule = {
  startBlocking(packageNames: string[], endAtMs: number): void;
  stopBlocking(): void;
  hasUsageAccess(): boolean;
  hasOverlayPermission(): boolean;
};

const NativeModule = requireOptionalNativeModule<TintAppBlockerNativeModule>('TintAppBlocker');

export function isAvailable(): boolean {
  return NativeModule !== null;
}

/** Starts the foreground service — always shows a persistent, live-counting
 *  "focus session active" notification (visible from the notification
 *  shade while backgrounded) using `endAtMs` for the countdown, and
 *  additionally polls the foreground app + shows the block overlay for
 *  anything in `packageNames` (an empty array just means no blocking, the
 *  notification/timer still runs). No-op if unavailable. */
export function startBlocking(packageNames: string[], endAtMs: number): void {
  NativeModule?.startBlocking(packageNames, endAtMs);
}

/** Stops polling, removes any visible overlay, and stops the service. */
export function stopBlocking(): void {
  NativeModule?.stopBlocking();
}

/** Real OS-reported Usage Access grant state (not self-reported). */
export function hasUsageAccess(): boolean {
  return NativeModule?.hasUsageAccess() ?? false;
}

/** Real OS-reported "display over other apps" grant state. */
export function hasOverlayPermission(): boolean {
  return NativeModule?.hasOverlayPermission() ?? false;
}
