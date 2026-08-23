# TINT Privacy Policy

_Last updated: 2026-08-23_

TINT ("the app") is a study-focus and productivity app for exam students (JEE, UCEED, NID, NIFT, and self-added exams). This policy explains what data TINT collects, why, and how it's handled.

## 1. What we collect

When you create an account (including an anonymous/guest account), TINT stores:

- **Profile info**: display name, email (only if you sign up with email — guest accounts have none), chosen avatar, selected exam(s) or a custom exam you typed in (name, date, task list).
- **Progress data**: daily task completion, focus-session lengths, streak count and history, total tasks completed, and your daily focus-time goal.
- **Friends data**: if you add friends inside the app, we store the friend request/connection itself (who is connected to whom) and expose only focus-time totals (today / this week / all-time) and streak to your friends — never messages, photos, calls, or any other content, because TINT does not have messaging, photo-sharing, or calling features at all.

We do **not** collect precise location, contacts, camera/microphone data, or browsing history.

## 2. App-blocking permissions (Android)

TINT can optionally redirect you to Android's system settings to grant:

- **Usage Access** — lets TINT see which app is in the foreground, so it can tell when you've left the app during a focus session.
- **Display over other apps (overlay)** — lets TINT show a block screen over distracting apps during a focus session.

These permissions are granted directly by you in Android's own settings screens — TINT never silently requests or auto-grants them. TINT does not read the content of other apps, your notifications, or your screen; it only checks which app is currently in the foreground for the sole purpose of app-blocking during a focus session you started.

## 3. How your data is stored

Your account data is stored in our backend database (Supabase/Postgres) with row-level security: only you can read or write your own profile and progress data through the app. A small set of fields (name, avatar, exam(s), streak, and total tasks completed) is readable by other users for the leaderboard feature — your email, today's task list, and focus log are never exposed to other users.

Some data (like today's tasks) is also cached locally on your device so the app works offline, and syncs back to the server when you're online.

## 4. What we don't do

- We don't sell your data.
- We don't show ads or use third-party ad/analytics trackers.
- We don't share your data with third parties, except the infrastructure providers needed to run the app (our database host).

## 5. Your choices

- You can use TINT as a guest without providing an email.
- You can remove friends at any time, which stops sharing your focus stats with them.
- To request deletion of your account and data, contact us at the email below.

## 6. Children's privacy

TINT is intended for students preparing for competitive exams and is not directed at children under 13. We don't knowingly collect data from children under 13.

## 7. Changes to this policy

If this policy changes, the "Last updated" date above will change and, for material changes, we'll notify users inside the app.

## 8. Contact

Questions about this policy or your data: **codingemail50@gmail.com**
