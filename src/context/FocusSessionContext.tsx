import React, { createContext, useContext, useMemo, useState } from 'react';

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
}

const IDLE_STATUS: FocusSessionStatus = { active: false, paused: false, timeLeft: 0, title: '', source: null };

interface Ctx {
  status: FocusSessionStatus;
  setStatus: (s: FocusSessionStatus) => void;
}

const FocusSessionContext = createContext<Ctx | null>(null);

export const FocusSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<FocusSessionStatus>(IDLE_STATUS);
  const value = useMemo(() => ({ status, setStatus }), [status]);
  return <FocusSessionContext.Provider value={value}>{children}</FocusSessionContext.Provider>;
};

export function useFocusSessionStatus(): Ctx {
  const ctx = useContext(FocusSessionContext);
  if (!ctx) throw new Error('useFocusSessionStatus must be used within a FocusSessionProvider');
  return ctx;
}
