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
  startChallengeBlocking(packageNames: string[], startAtMs: number, endAtMs: number, title: string): void;
  emergencyPause(durationMs: number): void;
  getChallengeBlockStats(): string;
  getUsageSummary(packageNames: string[], fromMs: number, toMs: number): string;
  stopBlocking(): void;
  // Optional: not present in a native build made before it was added.
  stopSessionBlocking?(): void;
  setPaused(paused: boolean, endAtMs: number): void;
  // Optional: not present in a native build made before it was added.
  setExamCountdowns?(json: string): void;
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

/** 7-day challenge blocking: saved so it survives kills and reboots, shows a
 *  "6d 23h 59m" notification with no pause button, and blocks from
 *  `startAtMs` (0 = now) until `endAtMs`. */
export function startChallengeBlocking(packageNames: string[], startAtMs: number, endAtMs: number, title: string): void {
  NativeModule?.startChallengeBlocking(packageNames, startAtMs, endAtMs, title);
}

/** Lifts blocking for `durationMs`, then it resumes on its own. */
export function emergencyPause(durationMs: number): void {
  NativeModule?.emergencyPause(durationMs);
}

/** Per-day counts of blocked-app opens during a challenge, as
 *  {"yyyyMMdd": {"<package>": count}}. Empty object when unavailable. */
export function getChallengeBlockStats(): Record<string, Record<string, number>> {
  try {
    return JSON.parse(NativeModule?.getChallengeBlockStats() ?? '{}');
  } catch {
    return {};
  }
}

/** Real opens + foreground time of the given apps between two timestamps,
 *  from Android's usage log (only about a week is kept). */
export function getUsageSummary(
  packageNames: string[],
  fromMs: number,
  toMs: number
): Record<string, { opens: number; foregroundMs: number }> {
  try {
    return JSON.parse(NativeModule?.getUsageSummary(packageNames, fromMs, toMs) ?? '{}');
  } catch {
    return {};
  }
}

/** Stops polling, removes any visible overlay, and stops the service. */
export function stopBlocking(): void {
  NativeModule?.stopBlocking();
}

/** A focus session ended (finished, ended early, left). Unlike stopBlocking()
 *  this never ends a running 7 Day Lock In: the service only drops the
 *  session's own apps, and stops itself only when no challenge is running.
 *  An older native build without it falls back to stopBlocking(). */
export function stopSessionBlocking(): void {
  if (NativeModule?.stopSessionBlocking) NativeModule.stopSessionBlocking();
  else NativeModule?.stopBlocking();
}

/** Reflects a JS-side pause/resume into the notification (icon + label +
 *  chronometer state) — does not itself start/stop polling or overlays. */
export function setPaused(paused: boolean, endAtMs: number): void {
  NativeModule?.setPaused(paused, endAtMs);
}

/** Saves the person's exam dates on the phone so the block screen can say
 *  "UCEED in 83 days". The days are counted when the block screen appears, so
 *  they stay right through a 7 Day Lock In even if TINT is closed. Nothing
 *  leaves the phone. An older native build without it just ignores the call. */
export function setExamCountdowns(items: { name: string; atMs: number; note?: string }[]): void {
  NativeModule?.setExamCountdowns?.(JSON.stringify(items));
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
