export type ExamType = 'JEE' | 'NEET' | 'UPSC' | 'CAT' | 'SAT' | 'BOARDS' | 'CUSTOM';

export interface Task {
  id: string;
  title: string;
  duration: number; // minutes
  category: string;
  isCustom?: boolean;
  completed?: boolean;
  completedAt?: string;
}

export const EXAM_TYPES: { id: ExamType; label: string; emoji: string; description: string }[] = [
  { id: 'JEE', label: 'JEE', emoji: '⚡', description: 'Joint Entrance Exam (Mains & Advanced)' },
  { id: 'NEET', label: 'NEET', emoji: '🔬', description: 'National Eligibility cum Entrance Test' },
  { id: 'UPSC', label: 'UPSC', emoji: '🏛️', description: 'Civil Services Examination' },
  { id: 'CAT', label: 'CAT', emoji: '📊', description: 'Common Admission Test (MBA)' },
  { id: 'SAT', label: 'SAT', emoji: '🌍', description: 'SAT / International College Admissions' },
  { id: 'BOARDS', label: 'Boards', emoji: '📚', description: 'Class 12 Board Examinations' },
  { id: 'CUSTOM', label: 'Custom', emoji: '✨', description: 'Build your own study plan' },
];

export const EXAM_PRESETS: Record<ExamType, Task[]> = {
  JEE: [
    { id: 'jee-1', title: 'Physics — Mechanics & Waves', duration: 90, category: 'Physics' },
    { id: 'jee-2', title: 'Chemistry — Organic Reactions', duration: 75, category: 'Chemistry' },
    { id: 'jee-3', title: 'Maths — Calculus Practice', duration: 90, category: 'Mathematics' },
    { id: 'jee-4', title: 'Previous Year Questions', duration: 60, category: 'Revision' },
    { id: 'jee-5', title: 'Formula Revision', duration: 30, category: 'Revision' },
  ],
  NEET: [
    { id: 'neet-1', title: 'Biology — Cell Biology & Genetics', duration: 90, category: 'Biology' },
    { id: 'neet-2', title: 'Physics — Modern Physics', duration: 60, category: 'Physics' },
    { id: 'neet-3', title: 'Chemistry — Biochemistry', duration: 75, category: 'Chemistry' },
    { id: 'neet-4', title: 'NCERT Deep Reading', duration: 60, category: 'Reading' },
    { id: 'neet-5', title: 'MCQ Practice Test', duration: 45, category: 'Practice' },
  ],
  UPSC: [
    { id: 'upsc-1', title: 'Current Affairs — Newspaper Reading', duration: 90, category: 'Current Affairs' },
    { id: 'upsc-2', title: 'Indian History & Culture', duration: 75, category: 'History' },
    { id: 'upsc-3', title: 'Geography & Environment', duration: 60, category: 'Geography' },
    { id: 'upsc-4', title: 'Polity & Governance', duration: 60, category: 'Polity' },
    { id: 'upsc-5', title: 'Essay Writing Practice', duration: 45, category: 'Writing' },
  ],
  CAT: [
    { id: 'cat-1', title: 'Quantitative Aptitude', duration: 90, category: 'Quant' },
    { id: 'cat-2', title: 'Verbal Ability & Reading Comprehension', duration: 75, category: 'VARC' },
    { id: 'cat-3', title: 'Data Interpretation & Logical Reasoning', duration: 90, category: 'DILR' },
    { id: 'cat-4', title: 'Mock Test Analysis', duration: 60, category: 'Analysis' },
  ],
  SAT: [
    { id: 'sat-1', title: 'Math — Algebra & Problem Solving', duration: 90, category: 'Math' },
    { id: 'sat-2', title: 'Reading & Writing', duration: 75, category: 'English' },
    { id: 'sat-3', title: 'Vocabulary Building', duration: 30, category: 'English' },
    { id: 'sat-4', title: 'Practice Test Section', duration: 60, category: 'Practice' },
  ],
  BOARDS: [
    { id: 'board-1', title: 'Mathematics — Chapter Practice', duration: 90, category: 'Math' },
    { id: 'board-2', title: 'Physics — Derivations & Problems', duration: 75, category: 'Physics' },
    { id: 'board-3', title: 'Chemistry — Equations Review', duration: 60, category: 'Chemistry' },
    { id: 'board-4', title: 'English — Essay & Comprehension', duration: 45, category: 'English' },
    { id: 'board-5', title: 'Sample Paper Practice', duration: 60, category: 'Practice' },
  ],
  CUSTOM: [
    { id: 'custom-1', title: 'Morning Study Session', duration: 120, category: 'Study' },
    { id: 'custom-2', title: 'Practice Questions', duration: 60, category: 'Practice' },
    { id: 'custom-3', title: 'Revision', duration: 45, category: 'Revision' },
  ],
};

export const MOTIVATIONAL_QUOTES = [
  { text: "The pain of discipline is nothing compared to the pain of regret.", author: "Unknown" },
  { text: "Your future self is watching you right now through memories.", author: "Aubrey de Grey" },
  { text: "Don't wish for it. Work for it.", author: "Unknown" },
  { text: "Every expert was once a beginner.", author: "Helen Hayes" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The harder you work, the luckier you get.", author: "Gary Player" },
  { text: "One day or day one. You decide.", author: "Unknown" },
];

export const REALITY_CHECK_MESSAGES = [
  { threshold: 30, message: "You've only hit 30% consistency. At this rate, you'll walk into the exam underprepared. That feeling? You can avoid it." },
  { threshold: 50, message: "50% isn't enough. Your competition is at their desks right now. The gap widens every day you don't." },
  { threshold: 70, message: "70% — close but not there. Top rankers are at 90%+. A few more hours daily separates you from them." },
  { threshold: 85, message: "85% — you're in striking distance. Don't let up now. The final stretch is where legends are made." },
  { threshold: 95, message: "95% consistency. You're already winning. Stay the course." },
];
