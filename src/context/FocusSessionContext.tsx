import React, { createContext, useContext, useMemo, useState } from 'react';

// A tiny shared channel so the always-running focus timer (which lives
// inside whichever FocusScreen instance started it — the Focus tab's own, or
// the one started from a Today task; both are shown on the Focus tab) can
// report its live status up to AppNavigator without lifting the whole
// timer/gesture/sheet implementation out of FocusScreen. AppNavigator uses
// this purely to know when to show the mini-player and what to put in it.
//
// Both FocusScreen instances (tab + task) can be mounted at the same time and
// each writes to this same status independently — setStatus is exposed as
// the real functional-update setState (not a plain value setter) so
// FocusScreen can guard against the idle instance clobbering the other
// one's genuinely active session (see the comment on its status effect).
export interface FocusSessionStatus {
  active: boolean;
  paused: boolean;
  timeLeft: number;
  title: string;
  /** Which FocusScreen instance owns the active session. */
  source: 'tab' | 'task' | null;
}

const IDLE_STATUS: FocusSessionStatus = { active: false, paused: false, timeLeft: 0, title: '', source: null };

interface Ctx {
  status: FocusSessionStatus;
  setStatus: React.Dispatch<React.SetStateAction<FocusSessionStatus>>;
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
