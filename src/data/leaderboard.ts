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
