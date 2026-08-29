import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

// A tiny shared channel so the always-running focus timer (which lives
// inside whichever FocusScreen instance started it — the Focus tab's, or
// the task-linked overlay's) can report its live status up to AppNavigator
// without lifting the whole timer/gesture/sheet implementation out of
// FocusScreen. AppNavigator uses this purely to know when to show the
// mini-player and what to put in it.
export interface FocusSessionStatus {
  active: boolean;
  paused: boolean;
  timeLeft: number;
  title: string;
  /** Which FocusScreen instance owns the active session, so AppNavigator
   *  can tell "the full UI for this is already on screen" from "the user
   *  navigated away and should see the mini-player instead." */
  source: 'tab' | 'task' | null;
  /** Task-linked sessions can be minimized back to the Today task list
   *  (via a chevron in FocusScreen's topBar) while staying mounted/ticking
   *  underneath — this tells AppNavigator to show the mini-player even
   *  while the 'todo' screen is what's technically on screen. Tab sessions
   *  never set this (there's nothing to minimize away from). */
  minimized: boolean;
}

const IDLE_STATUS: FocusSessionStatus = { active: false, paused: false, timeLeft: 0, title: '', source: null, minimized: false };

interface Ctx {
  status: FocusSessionStatus;
  setStatus: (s: FocusSessionStatus) => void;
  /** Bumped whenever the mini-player is tapped for a minimized task
   *  session — TodoScreen watches this to re-expand its overlay, since
   *  navigating to the (already-current) 'todo' screen alone wouldn't
   *  otherwise signal anything. */
  expandSignal: number;
  requestExpand: () => void;
}

const FocusSessionContext = createContext<Ctx | null>(null);

export const FocusSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<FocusSessionStatus>(IDLE_STATUS);
  const [expandSignal, setExpandSignal] = useState(0);
  const requestExpand = useCallback(() => setExpandSignal(n => n + 1), []);
  const value = useMemo(() => ({ status, setStatus, expandSignal, requestExpand }), [status, expandSignal, requestExpand]);
  return <FocusSessionContext.Provider value={value}>{children}</FocusSessionContext.Provider>;
};

export function useFocusSessionStatus(): Ctx {
  const ctx = useContext(FocusSessionContext);
  if (!ctx) throw new Error('useFocusSessionStatus must be used within a FocusSessionProvider');
  return ctx;
}
