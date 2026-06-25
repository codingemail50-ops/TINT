export type TaskCategory = 'drawing' | 'aptitude' | 'theory' | 'health';
export type TaskStatus = 'upcoming' | 'done' | 'missed';
export type ExamType = 'UCEED' | 'NID' | 'NIFT' | 'JEE';
export type RepeatType = 'daily' | 'weekday';

export interface Task {
  id: string;
  emoji: string;
  title: string;
  cat: TaskCategory;
  dur: number; // minutes
  repeat: RepeatType;
  status: TaskStatus;
}

export interface HistoryEntry {
  date: string; // YYYY-MM-DD
  allDone: boolean;
  pct: number; // 0-100
  missedCount: number;
  skippedTask: string | null;
  missedTasks: string[];
}

export interface FocusLog {
  date: string; // YYYY-MM-DD
  mins: number;
}

export interface UserProfile {
  name: string;
  avatar: string; // emoji
  email: string;
  exams: ExamType[];
}

export interface AppState {
  profile: UserProfile;
  tasks: Task[];
  history: HistoryEntry[];
  focusLog: FocusLog[];
  streak: number;
  missedDays: number;
  lastResetDate: string;
}

export interface LeaderboardEntry {
  name: string;
  avatar: string;
  email: string;
  streak: number;
  consistency_score: number;
  focus_today: number;
  focus_week: number;
  focus_total: number;
}
