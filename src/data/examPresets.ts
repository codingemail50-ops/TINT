export type ExamType = 'JEE' | 'NEET' | 'CLASS12' | 'CLASS10' | 'UCEED' | 'NID' | 'NIFT' | 'IPMAT';

export type ClassTwelveStream = 'Science' | 'Commerce' | 'Humanities';
export const CLASS_TWELVE_STREAMS: ClassTwelveStream[] = ['Science', 'Commerce', 'Humanities'];

export interface Task {
  id: string;
  title: string;
  duration: number; // minutes
  category: string;
  isCustom?: boolean;
  completed?: boolean;
  completedAt?: string;
  repeat?: boolean;
  /** Set by the user when creating the task. Puts it in its own
   *  orange-panel section above the regular To Do list. */
  priority?: 'high';
}

// A user-authored exam+task set, for anyone whose exam isn't one of the four
// built-in presets — picked via "Other" on the avatar/exam screen. Runs
// through the exact same daily-task and focus-timer machinery as a preset,
// just seeded from what they typed instead of BASE_TASKS.
export interface CustomExam {
  name: string;
  date: string; // YYYY-MM-DD
  tasks: { title: string; duration: number }[];
}

// Order here is deliberate — JEE and NEET first (the two most common
// entrances), then the two board exams, then the design entrances, IPMAT,
// with "Other" rendered separately (and last) by whichever screen renders
// this list rather than living here.
export const EXAM_TYPES: { id: ExamType; label: string; icon: string; description: string; color: string }[] = [
  { id: 'JEE',    label: 'JEE',      icon: 'flash',         description: 'Joint Entrance Exam — Mains & Advanced', color: '#3B82F6' },
  { id: 'NEET',   label: 'NEET',     icon: 'medkit',        description: 'National Eligibility cum Entrance Test — Medical', color: '#EF4444' },
  { id: 'CLASS12', label: 'Class 12', icon: 'school',       description: 'Class 12 board exams', color: '#22C55E' },
  { id: 'CLASS10', label: 'Class 10', icon: 'school-outline', description: 'Class 10 board exams', color: '#14B8A6' },
  { id: 'UCEED',  label: 'UCEED',    icon: 'pencil',        description: 'Undergraduate Common Entrance Exam for Design', color: '#8B5CF6' },
  { id: 'NID',    label: 'NID',      icon: 'color-palette', description: 'National Institute of Design Entrance', color: '#EC4899' },
  { id: 'NIFT',   label: 'NIFT',     icon: 'shirt',         description: 'National Institute of Fashion Technology', color: '#F59E0B' },
  { id: 'IPMAT',  label: 'IPMAT',    icon: 'calculator',    description: 'Integrated Program in Management Aptitude Test', color: '#6366F1' },
];

const BASE_TASKS: Record<ExamType, Task[]> = {
  JEE: [
    { id: 'jee-1', title: 'Mathematics — Calculus & Algebra',     duration: 90, category: 'Mathematics' },
    { id: 'jee-2', title: 'Physics — Mechanics & Waves',          duration: 90, category: 'Physics' },
    { id: 'jee-3', title: 'Chemistry — Organic & Inorganic',      duration: 75, category: 'Chemistry' },
    { id: 'jee-4', title: 'Previous Year Questions',              duration: 60, category: 'Practice' },
    { id: 'jee-5', title: 'Formula Revision',                     duration: 30, category: 'Revision' },
  ],
  NEET: [
    { id: 'neet-1', title: 'Biology — Botany & Zoology',          duration: 90, category: 'Biology' },
    { id: 'neet-2', title: 'Physics — Mechanics & Waves',         duration: 75, category: 'Physics' },
    { id: 'neet-3', title: 'Chemistry — Organic & Inorganic',     duration: 75, category: 'Chemistry' },
    { id: 'neet-4', title: 'Previous Year Questions',             duration: 60, category: 'Practice' },
    { id: 'neet-5', title: 'NCERT Line-by-Line Revision',         duration: 30, category: 'Revision' },
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
  // Class 10 doesn't split by stream — same subject set for everyone.
  CLASS10: [
    { id: 'c10-1',  title: 'Physics',          duration: 40, category: 'Boards' },
    { id: 'c10-2',  title: 'Chemistry',        duration: 40, category: 'Boards' },
    { id: 'c10-3',  title: 'Biology',          duration: 40, category: 'Boards' },
    { id: 'c10-4',  title: 'Mathematics',      duration: 45, category: 'Boards' },
    { id: 'c10-5',  title: 'History',          duration: 30, category: 'Boards' },
    { id: 'c10-6',  title: 'Geography',        duration: 30, category: 'Boards' },
    { id: 'c10-7',  title: 'Civics',           duration: 30, category: 'Boards' },
    { id: 'c10-8',  title: 'Economics',        duration: 30, category: 'Boards' },
    { id: 'c10-9',  title: 'English',          duration: 30, category: 'Boards' },
    { id: 'c10-10', title: 'Second Language',  duration: 30, category: 'Boards' },
  ],
  // Placeholder here — Class 12 actually branches by stream (see
  // CLASS12_STREAM_TASKS below); this entry only exists to satisfy
  // Record<ExamType, Task[]> and is never read directly on its own.
  CLASS12: [
    { id: 'c12-1', title: 'Physics',            duration: 60, category: 'Boards' },
    { id: 'c12-2', title: 'Chemistry',          duration: 60, category: 'Boards' },
    { id: 'c12-3', title: 'Mathematics',        duration: 60, category: 'Boards' },
    { id: 'c12-4', title: 'Practice Problems',  duration: 45, category: 'Practice' },
  ],
  IPMAT: [
    { id: 'ipmat-1', title: 'Quantitative Ability Practice',     duration: 60, category: 'Aptitude' },
    { id: 'ipmat-2', title: 'Verbal Ability & Reading Comprehension', duration: 60, category: 'Aptitude' },
    { id: 'ipmat-3', title: 'Logical Reasoning Practice',        duration: 45, category: 'Aptitude' },
  ],
};

// Class 12 boards vary a lot by stream — enough that one generic list
// doesn't fit anyone well. Kept small and editable, same reasoning as
// every other preset here.
const CLASS12_STREAM_TASKS: Record<ClassTwelveStream, Task[]> = {
  Science: BASE_TASKS.CLASS12, // PCM
  Commerce: [
    { id: 'c12-com-1', title: 'Business Studies',      duration: 60, category: 'Boards' },
    { id: 'c12-com-2', title: 'Accountancy',           duration: 60, category: 'Boards' },
    { id: 'c12-com-3', title: 'Applied Mathematics',   duration: 60, category: 'Boards' },
    { id: 'c12-com-4', title: 'Economics',             duration: 45, category: 'Boards' },
  ],
  Humanities: [
    { id: 'c12-hum-1', title: 'Political Science',     duration: 60, category: 'Boards' },
    { id: 'c12-hum-2', title: 'Entrepreneurship',      duration: 60, category: 'Boards' },
    { id: 'c12-hum-3', title: 'Accountancy',           duration: 60, category: 'Boards' },
    { id: 'c12-hum-4', title: 'History',               duration: 45, category: 'Boards' },
  ],
};

export function getCombinedPreset(exams: ExamType[], classTwelveStream?: ClassTwelveStream): Task[] {
  if (exams.length === 0) return [];
  if (exams.length === 1) {
    if (exams[0] === 'CLASS12') return CLASS12_STREAM_TASKS[classTwelveStream ?? 'Science'].map(t => ({ ...t }));
    return BASE_TASKS[exams[0]].map(t => ({ ...t }));
  }

  const hasJEE     = exams.includes('JEE');
  const hasNEET    = exams.includes('NEET');
  const hasUCEED   = exams.includes('UCEED');
  const hasNID     = exams.includes('NID');
  const hasNIFT    = exams.includes('NIFT');
  const hasClass10 = exams.includes('CLASS10');
  const hasClass12 = exams.includes('CLASS12');
  const hasIPMAT   = exams.includes('IPMAT');

  const tasks: Task[] = [];

  // Math — JEE core, also helps UCEED spatial
  if (hasJEE) {
    tasks.push({ id: 'c-math', title: 'Mathematics — JEE Focus', duration: hasUCEED ? 75 : 90, category: 'Mathematics' });
  }
  // Biology — NEET only, no overlap with anything else here
  if (hasNEET) {
    tasks.push({ id: 'c-bio', title: 'Biology — Botany & Zoology', duration: 90, category: 'Biology' });
  }
  // Physics — shared by JEE and NEET, one task either way
  if (hasJEE || hasNEET) {
    tasks.push({ id: 'c-phys', title: 'Physics', duration: 60, category: 'Physics' });
  }
  // Chemistry — shared by JEE and NEET (skip if purely design combo)
  if ((hasJEE || hasNEET) && exams.length <= 2) {
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

  // Boards — common alongside JEE (prepping for both at once) or the
  // design entrances. Deliberately one generic task, not a subject list —
  // same reasoning as the standalone CLASS10/CLASS12 presets above.
  if (hasClass10 || hasClass12) {
    tasks.push({ id: 'c-board', title: 'Board Exam Revision', duration: 60, category: 'Boards' });
  }

  // IPMAT's aptitude sections don't overlap with any of the above.
  if (hasIPMAT) {
    tasks.push({ id: 'c-ipmat', title: 'Quantitative & Verbal Ability Practice', duration: 60, category: 'Aptitude' });
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

// PixelIconName keys (see src/components/pixelIcons.ts) used as user avatars
// — full-color pixel-art icons, the one deliberate break from the app's
// greyscale/orange theme.
export const AVATARS = [
  'star', 'heart', 'bomb', 'coin', 'cherry',
  'watermelon', 'strawberry', 'mushroom', 'cat', 'fox',
  'panda', 'pizza', 'donut', 'frog', 'owl',
  'bear', 'alien', 'robot', 'grapes', 'apple',
];
