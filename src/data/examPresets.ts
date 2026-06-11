export type ExamType = 'JEE' | 'UCEED' | 'NID' | 'NIFT';

export interface Task {
  id: string;
  title: string;
  duration: number; // minutes
  category: string;
  isCustom?: boolean;
  completed?: boolean;
  completedAt?: string;
  repeat?: boolean;
}

export const EXAM_TYPES: { id: ExamType; label: string; emoji: string; description: string; color: string }[] = [
  { id: 'JEE',   label: 'JEE',   emoji: '⚡', description: 'Joint Entrance Exam — Mains & Advanced', color: '#3B82F6' },
  { id: 'UCEED', label: 'UCEED', emoji: '✏️', description: 'Undergraduate Common Entrance Exam for Design', color: '#8B5CF6' },
  { id: 'NID',   label: 'NID',   emoji: '🎨', description: 'National Institute of Design Entrance', color: '#EC4899' },
  { id: 'NIFT',  label: 'NIFT',  emoji: '👗', description: 'National Institute of Fashion Technology', color: '#F59E0B' },
];

const BASE_TASKS: Record<ExamType, Task[]> = {
  JEE: [
    { id: 'jee-1', title: 'Mathematics — Calculus & Algebra',     duration: 90, category: 'Mathematics' },
    { id: 'jee-2', title: 'Physics — Mechanics & Waves',          duration: 90, category: 'Physics' },
    { id: 'jee-3', title: 'Chemistry — Organic & Inorganic',      duration: 75, category: 'Chemistry' },
    { id: 'jee-4', title: 'Previous Year Questions',              duration: 60, category: 'Practice' },
    { id: 'jee-5', title: 'Formula Revision',                     duration: 30, category: 'Revision' },
  ],
  UCEED: [
    { id: 'uceed-1', title: 'Observation Drawing',                duration: 60, category: 'Drawing' },
    { id: 'uceed-2', title: 'Visual Design & Composition',        duration: 60, category: 'Design' },
    { id: 'uceed-3', title: 'Spatial Reasoning Practice',         duration: 45, category: 'Aptitude' },
    { id: 'uceed-4', title: 'Design Thinking Problems',           duration: 45, category: 'Design' },
    { id: 'uceed-5', title: 'Portfolio Work',                     duration: 60, category: 'Portfolio' },
  ],
  NID: [
    { id: 'nid-1', title: 'Studio Drawing — Observation',        duration: 75, category: 'Drawing' },
    { id: 'nid-2', title: 'Memory Drawing Practice',             duration: 45, category: 'Drawing' },
    { id: 'nid-3', title: 'Design Aptitude Problems',            duration: 60, category: 'Design' },
    { id: 'nid-4', title: 'Design History & Theory',             duration: 45, category: 'Theory' },
    { id: 'nid-5', title: 'Creative Exploration (Craft/Model)',  duration: 60, category: 'Portfolio' },
  ],
  NIFT: [
    { id: 'nift-1', title: 'Fashion Illustration',               duration: 60, category: 'Drawing' },
    { id: 'nift-2', title: 'Creative Ability Practice',          duration: 60, category: 'Design' },
    { id: 'nift-3', title: 'General Ability — English & GK',     duration: 45, category: 'General' },
    { id: 'nift-4', title: 'Design Theory & Trends',             duration: 45, category: 'Theory' },
    { id: 'nift-5', title: 'Situation Test Prep',                duration: 45, category: 'Portfolio' },
  ],
};

export function getCombinedPreset(exams: ExamType[]): Task[] {
  if (exams.length === 0) return [];
  if (exams.length === 1) return BASE_TASKS[exams[0]].map(t => ({ ...t }));

  const hasJEE   = exams.includes('JEE');
  const hasUCEED = exams.includes('UCEED');
  const hasNID   = exams.includes('NID');
  const hasNIFT  = exams.includes('NIFT');

  const tasks: Task[] = [];

  // Math — JEE core, also helps UCEED spatial
  if (hasJEE) {
    tasks.push({ id: 'c-math', title: 'Mathematics — JEE Focus', duration: hasUCEED ? 75 : 90, category: 'Mathematics' });
  }
  // Physics — JEE
  if (hasJEE) {
    tasks.push({ id: 'c-phys', title: 'Physics', duration: 60, category: 'Physics' });
  }
  // Chemistry — JEE (skip if purely design combo)
  if (hasJEE && exams.length <= 2) {
    tasks.push({ id: 'c-chem', title: 'Chemistry', duration: 60, category: 'Chemistry' });
  }

  // Drawing — UCEED / NID share this heavily
  if (hasUCEED || hasNID) {
    tasks.push({ id: 'c-draw', title: 'Drawing Practice — Observation & Memory', duration: hasNID && hasUCEED ? 90 : 60, category: 'Drawing' });
  }
  // Fashion illustration — NIFT specific
  if (hasNIFT) {
    tasks.push({ id: 'c-fash', title: hasNID || hasUCEED ? 'Fashion Illustration & Design' : 'Fashion Illustration', duration: 60, category: 'Drawing' });
  }

  // Design thinking — UCEED/NID/NIFT overlap
  if (hasUCEED || hasNID || hasNIFT) {
    tasks.push({ id: 'c-design', title: 'Design Thinking & Aptitude', duration: 60, category: 'Design' });
  }

  // Portfolio — if any design exam
  if (hasUCEED || hasNID || hasNIFT) {
    tasks.push({ id: 'c-port', title: 'Portfolio Development', duration: 45, category: 'Portfolio' });
  }

  // Practice paper
  tasks.push({ id: 'c-pyq', title: 'Practice Questions / Mock Test', duration: 45, category: 'Practice' });

  return tasks.slice(0, 8); // cap at 8 tasks
}

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
  { threshold: 30, message: "Only 30% consistency. At this rate you'll walk into the exam underprepared. That feeling? Avoidable." },
  { threshold: 50, message: "50% isn't enough. Your competition is at their desks right now. Every skipped day widens the gap." },
  { threshold: 70, message: "70% — so close. Top rankers are at 90%+. A couple more hours a day separates you from them." },
  { threshold: 85, message: "85% — you're in striking distance. Don't let up. The final stretch is where legends are made." },
  { threshold: 95, message: "95% consistency. You're already winning. Stay the course." },
];

export const AVATARS = [
  '🎯','🔥','⚡','🧠','🏆','🚀','💎','🦁','⚔️','🐉',
  '🌟','💫','🦋','🌙','☄️','💡','🔬','⚗️','🎮','🦊',
];
