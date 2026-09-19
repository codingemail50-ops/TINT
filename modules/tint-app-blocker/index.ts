import { requireOptionalNativeModule, EventSubscription } from 'expo-modules-core';

/** Payload for the "onFocusNotificationAction" event — fired when the user
 *  taps Pause/Resume/End on the persistent focus-session notification. */
export type FocusNotificationActionEvent = {
  action: 'pause' | 'resume' | 'end';
};

// Thin, typed wrapper over the native "TintAppBlocker" module (see
// android/src/main/java/expo/modules/tintappblocker/). Returns null instead
// of throwing when the module isn't linked — true in Expo Go, web, and iOS,
// where every function below just becomes a safe no-op.
type TintAppBlockerNativeModule = {
  startBlocking(packageNames: string[], endAtMs: number, title: string, durationMins: number): void;
  stopBlocking(): void;
  setPaused(paused: boolean, endAtMs: number): void;
  hasUsageAccess(): boolean;
  hasOverlayPermission(): boolean;
  addListener(eventName: 'onFocusNotificationAction', listener: (event: FocusNotificationActionEvent) => void): EventSubscription;
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
 *  notification/timer still runs). `title` and `durationMins` are shown on
 *  the notification itself. No-op if unavailable. */
export function startBlocking(packageNames: string[], endAtMs: number, title: string, durationMins: number): void {
  NativeModule?.startBlocking(packageNames, endAtMs, title, durationMins);
}

/** Stops polling, removes any visible overlay, and stops the service. */
export function stopBlocking(): void {
  NativeModule?.stopBlocking();
}

/** Reflects a JS-side pause/resume into the notification (icon + label +
 *  chronometer state) — does not itself start/stop polling or overlays. */
export function setPaused(paused: boolean, endAtMs: number): void {
  NativeModule?.setPaused(paused, endAtMs);
}

/** Fires when the user taps Pause/Resume/End on the persistent notification.
 *  Returns a no-op unsubscribe if the native module isn't available. */
export function subscribeFocusNotificationAction(
  callback: (event: FocusNotificationActionEvent) => void
): () => void {
  const subscription = NativeModule?.addListener('onFocusNotificationAction', callback);
  return () => subscription?.remove();
}

/** Real OS-reported Usage Access grant state (not self-reported). */
export function hasUsageAccess(): boolean {
  return NativeModule?.hasUsageAccess() ?? false;
}

/** Real OS-reported "display over other apps" grant state. */
export function hasOverlayPermission(): boolean {
  return NativeModule?.hasOverlayPermission() ?? false;
}
