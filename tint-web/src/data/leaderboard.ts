export interface LeaderboardEntry {
  id: string
  name: string
  avatar: string
  exam: string
  streak: number
  consistency: number
  totalTasks: number
}

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { id: '1', name: 'Arjun Sharma', avatar: '🧠', exam: 'JEE', streak: 42, consistency: 94, totalTasks: 312 },
  { id: '2', name: 'Priya Nair', avatar: '🎨', exam: 'UCEED', streak: 38, consistency: 91, totalTasks: 287 },
  { id: '3', name: 'Rohit Verma', avatar: '🔥', exam: 'JEE', streak: 35, consistency: 88, totalTasks: 260 },
  { id: '4', name: 'Sneha Iyer', avatar: '🦋', exam: 'NID', streak: 31, consistency: 85, totalTasks: 241 },
  { id: '5', name: 'Karan Mehta', avatar: '🏆', exam: 'NIFT', streak: 29, consistency: 82, totalTasks: 219 },
  { id: '6', name: 'Ananya Gupta', avatar: '💫', exam: 'UCEED', streak: 27, consistency: 79, totalTasks: 198 },
  { id: '7', name: 'Vikram Singh', avatar: '⚡', exam: 'JEE', streak: 24, consistency: 76, totalTasks: 182 },
  { id: '8', name: 'Kavya Reddy', avatar: '🌟', exam: 'NID', streak: 22, consistency: 73, totalTasks: 167 },
  { id: '9', name: 'Aditya Patel', avatar: '🚀', exam: 'JEE', streak: 20, consistency: 70, totalTasks: 152 },
  { id: '10', name: 'Meera Krishnan', avatar: '💎', exam: 'NIFT', streak: 18, consistency: 67, totalTasks: 139 },
  { id: '11', name: 'Harsh Agarwal', avatar: '🦁', exam: 'JEE', streak: 16, consistency: 64, totalTasks: 124 },
  { id: '12', name: 'Riya Desai', avatar: '🌙', exam: 'UCEED', streak: 14, consistency: 61, totalTasks: 109 },
  { id: '13', name: 'Siddharth Joshi', avatar: '⚔️', exam: 'NID', streak: 12, consistency: 58, totalTasks: 96 },
  { id: '14', name: 'Tanvi Malhotra', avatar: '☄️', exam: 'NIFT', streak: 10, consistency: 55, totalTasks: 83 },
  { id: '15', name: 'Nikhil Rao', avatar: '🎯', exam: 'JEE', streak: 8, consistency: 52, totalTasks: 71 },
]
