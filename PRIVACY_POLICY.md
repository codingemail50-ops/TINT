# TINT Privacy Policy

_Last updated: 2026-09-01_

TINT ("the app") is a study-focus and productivity app for exam students (JEE, UCEED, NID, NIFT, and self-added exams). This policy explains what data TINT collects, why, and how it's handled.

## 1. What we collect

When you create an account (including an anonymous/guest account), TINT stores:

- **Profile info**: display name, email (only if you sign up with email — guest accounts have none), chosen avatar, selected exam(s) or a custom exam you typed in (name, date, task list).
- **Progress data**: daily task completion, focus-session lengths, streak count and history, total tasks completed, and your daily focus-time goal.
- **Friends data**: if you add friends inside the app, we store the friend request/connection itself (who is connected to whom) and expose only focus-time totals (today / this week / all-time) and streak to your friends — never messages, photos, calls, or any other content, because TINT does not have messaging, photo-sharing, or calling features at all.

We do **not** collect precise location, contacts, camera/microphone data, or browsing history.

## 2. App-blocking permissions (Android)

If you choose to block distracting apps during a focus session, TINT redirects you to Android's own system settings screens to grant:

- **Usage Access** — lets TINT see which app is currently in the foreground.
- **Display over other apps (overlay)** — lets TINT show a block screen over an app you've chosen to block.

These permissions are granted directly by you in Android's settings — TINT never silently requests or auto-grants them, and you can revoke either one at any time in Android's own Settings app.

**When monitoring runs, and what it does:** Foreground-app checking only runs while a focus session you started is active, and only if you've granted Usage Access. TINT runs an Android foreground service (shown as a persistent notification, as Android requires for any app doing ongoing work like this) that checks every 1–2 seconds which app is in front. If it's one you've chosen to block, TINT shows a block screen over it; tapping "Return to TINT" brings you back to the app. The moment your focus session ends — naturally, or because you end it early — this checking stops immediately, the foreground service shuts down, and the notification disappears. Closing TINT entirely (swiping it from your recent apps) also stops it. Nothing runs when no focus session is active, and nothing restarts automatically after your phone reboots.

**What TINT does *not* do:** it does not read the content, notifications, or screen of other apps — it only ever checks *which app's name* is currently in front, and only to compare it against apps you personally chose to block.

**What's stored or transmitted:** none of this foreground-app-checking data is stored anywhere, on your device or on our servers, and none of it is ever transmitted off your device. It exists only in memory while a check happens, purely to decide whether to show the block screen right then. The only related thing TINT does store (locally on your device) is your own list of *which apps you've chosen to block* — that list never leaves your device either.

## 3. How your data is stored

Your account data is stored in our backend database (Supabase/Postgres) with row-level security: only you can read or write your own profile and progress data through the app. A small set of fields (name, avatar, exam(s), streak, and total tasks completed) is readable by other users for the leaderboard feature — your email, today's task list, and focus log are never exposed to other users.

Some data (like today's tasks) is also cached locally on your device so the app works offline, and syncs back to the server when you're online.

## 4. What we don't do

- We don't sell your data.
- We don't show ads or use third-party ad/analytics trackers.
- We don't share your data with third parties, except the infrastructure providers needed to run the app (our database host).

## 5. Notifications

If you allow it, TINT sends a local notification when a focus session finishes while the app is in the background — generated entirely on your device, not sent from our servers, and not tied to any data beyond the fact that your session ended.

## 6. Your choices

- You can use TINT as a guest without providing an email.
- You can remove friends at any time, which stops sharing your focus stats with them.
- To request deletion of your account and data, contact us at the email below.

## 7. Children's privacy

TINT is intended for students preparing for competitive exams and is not directed at children under 13. We don't knowingly collect data from children under 13.

## 8. Changes to this policy

If this policy changes, the "Last updated" date above will change and, for material changes, we'll notify users inside the app.

## 9. Contact

Questions about this policy or your data: **codingemail50@gmail.com**
