export interface LeaderboardEntry {
  id: string;
  name: string;
  streak: number;
  consistency: number;
  tasksCompleted: number;
  avatar: string;
  examType: string;
  isCurrentUser?: boolean;
}

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { id: '1', name: 'Aryan S.', streak: 47, consistency: 96, tasksCompleted: 423, avatar: '🧠', examType: 'JEE' },
  { id: '2', name: 'Priya K.', streak: 41, consistency: 93, tasksCompleted: 389, avatar: '⚡', examType: 'NEET' },
  { id: '3', name: 'Rohit M.', streak: 38, consistency: 91, tasksCompleted: 356, avatar: '🔥', examType: 'JEE' },
  { id: '4', name: 'Ananya R.', streak: 35, consistency: 88, tasksCompleted: 312, avatar: '💫', examType: 'BOARDS' },
  { id: '5', name: 'Dev P.', streak: 29, consistency: 84, tasksCompleted: 278, avatar: '🎯', examType: 'NEET' },
  { id: '6', name: 'Meera V.', streak: 22, consistency: 79, tasksCompleted: 245, avatar: '🌟', examType: 'CAT' },
  { id: '7', name: 'Karan T.', streak: 18, consistency: 74, tasksCompleted: 198, avatar: '⚔️', examType: 'JEE' },
  { id: '8', name: 'Sneha B.', streak: 15, consistency: 68, tasksCompleted: 167, avatar: '🚀', examType: 'UPSC' },
  { id: '9', name: 'Aditya L.', streak: 11, consistency: 61, tasksCompleted: 143, avatar: '💡', examType: 'SAT' },
  { id: '10', name: 'Ishaan C.', streak: 7, consistency: 54, tasksCompleted: 112, avatar: '🌊', examType: 'BOARDS' },
];
