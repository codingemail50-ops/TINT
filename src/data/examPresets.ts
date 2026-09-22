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
  // Problem-heavy by design — JEE rewards volume. Numbers in the titles
  // (25 problems, 30 minutes of PYQs) are starting points; duration and
  // title are editable per-task like any other task in the app, so a
  // student can dial them up or down without losing the preset.
  JEE: [
    { id: 'jee-1', title: 'Solve 25 JEE-level problems',           duration: 60, category: 'Practice' },
    { id: 'jee-2', title: "Complete today's Physics problem set",  duration: 60, category: 'Physics' },
    { id: 'jee-3', title: "Complete today's Chemistry problem set", duration: 60, category: 'Chemistry' },
    { id: 'jee-4', title: "Complete today's Maths problem set",    duration: 60, category: 'Mathematics' },
    { id: 'jee-5', title: 'Review 10 previous mistakes',           duration: 20, category: 'Revision' },
    { id: 'jee-6', title: 'Solve 30 minutes of PYQs under a timer', duration: 30, category: 'Timed Practice' },
    { id: 'jee-7', title: 'Analyze one timed test',                duration: 30, category: 'Analysis' },
  ],
  // NEET's edge over a generic to-do app: "study biology" becomes a
  // countable, closeable task (50 MCQs, one topic, one recall pass).
  NEET: [
    { id: 'neet-1', title: 'Solve 50 Biology MCQs',                duration: 60, category: 'Biology' },
    { id: 'neet-2', title: 'Solve 25 Physics MCQs',                duration: 45, category: 'Physics' },
    { id: 'neet-3', title: 'Solve 25 Chemistry MCQs',              duration: 45, category: 'Chemistry' },
    { id: 'neet-4', title: 'Revise one Biology topic using active recall', duration: 30, category: 'Revision' },
    { id: 'neet-5', title: "Review today's incorrect MCQs",        duration: 20, category: 'Revision' },
    { id: 'neet-6', title: 'Complete one timed 60-question set',   duration: 60, category: 'Timed Practice' },
    { id: 'neet-7', title: 'Analyze one mock/test',                duration: 30, category: 'Analysis' },
  ],
  // Deliberately not a JEE/NEET clone — UCEED rewards observation,
  // ideation and spatial reasoning over problem-solving volume.
  UCEED: [
    { id: 'uceed-1', title: '20 min observational drawing',        duration: 20, category: 'Drawing' },
    { id: 'uceed-2', title: '10 visualisation/spatial reasoning questions', duration: 30, category: 'Aptitude' },
    { id: 'uceed-3', title: '1 UCEED Part-A timed set',            duration: 45, category: 'Timed Practice' },
    { id: 'uceed-4', title: '1 product/design ideation exercise',  duration: 45, category: 'Design' },
    { id: 'uceed-5', title: 'Draw 5 thumbnail concepts',           duration: 30, category: 'Drawing' },
    { id: 'uceed-6', title: 'Review 5 previous mistakes',          duration: 20, category: 'Revision' },
    { id: 'uceed-7', title: '1 timed Part-B practice',             duration: 45, category: 'Timed Practice' },
  ],
  // Kept loose on purpose — NID's creative component benefits from
  // variety, so tasks read as prompts to explore rather than fixed drills.
  NID: [
    { id: 'nid-1', title: '20 min observational drawing',          duration: 20, category: 'Drawing' },
    { id: 'nid-2', title: '1 visual problem-solving exercise',     duration: 30, category: 'Design' },
    { id: 'nid-3', title: '5 thumbnail ideas from one prompt',     duration: 30, category: 'Drawing' },
    { id: 'nid-4', title: '1 product/scene sketch',                duration: 45, category: 'Drawing' },
    { id: 'nid-5', title: '20 aptitude questions',                 duration: 30, category: 'Aptitude' },
    { id: 'nid-6', title: 'Review previous design mistakes',       duration: 20, category: 'Revision' },
    { id: 'nid-7', title: '1 timed DAT-style practice set',        duration: 45, category: 'Timed Practice' },
  ],
  // NIFT (NTA-administered) blends creative sketching with quant/verbal
  // aptitude — the task list mirrors that mix rather than leaning design-only.
  NIFT: [
    { id: 'nift-1', title: '20 min fashion/product sketching',     duration: 20, category: 'Drawing' },
    { id: 'nift-2', title: '10 quantitative questions',            duration: 20, category: 'Aptitude' },
    { id: 'nift-3', title: '10 communication/verbal questions',    duration: 20, category: 'Aptitude' },
    { id: 'nift-4', title: '1 creative ideation prompt',           duration: 30, category: 'Design' },
    { id: 'nift-5', title: 'Practice one timed section',           duration: 30, category: 'Timed Practice' },
    { id: 'nift-6', title: 'Review incorrect questions',           duration: 20, category: 'Revision' },
    { id: 'nift-7', title: 'Complete one mixed mock section',      duration: 45, category: 'Timed Practice' },
  ],
  // Boards favor writing practice over MCQ grinding, so the list leans on
  // long-form answers and syllabus chapters rather than raw question counts.
  CLASS10: [
    { id: 'c10-1', title: "Revise one chapter from today's syllabus", duration: 45, category: 'Revision' },
    { id: 'c10-2', title: 'Solve 20 board-style questions',        duration: 45, category: 'Practice' },
    { id: 'c10-3', title: 'Write 5 answers without looking at notes', duration: 30, category: 'Writing Practice' },
    { id: 'c10-4', title: "Review yesterday's mistakes",           duration: 20, category: 'Revision' },
    { id: 'c10-5', title: 'Practice one case-study/application question', duration: 25, category: 'Practice' },
    { id: 'c10-6', title: 'Complete one timed 30-minute section',  duration: 30, category: 'Timed Practice' },
    { id: 'c10-7', title: 'Revise formulas / definitions / key dates', duration: 20, category: 'Revision' },
  ],
  // Same task shape as Class 10 across every stream (Science/Commerce/
  // Humanities) — these are study habits, not subject lists, so one set
  // fits all three; see CLASS12_STREAM_TASKS below.
  CLASS12: [
    { id: 'c12-1', title: "Complete today's chapter target",       duration: 60, category: 'Study' },
    { id: 'c12-2', title: 'Solve 25–30 board-level questions',     duration: 60, category: 'Practice' },
    { id: 'c12-3', title: "Active-recall yesterday's topic",       duration: 20, category: 'Revision' },
    { id: 'c12-4', title: 'Review your error log',                 duration: 20, category: 'Revision' },
    { id: 'c12-5', title: 'Write one long-answer response under time', duration: 30, category: 'Writing Practice' },
    { id: 'c12-6', title: 'Solve one previous-year question set',  duration: 45, category: 'Practice' },
    { id: 'c12-7', title: 'Complete one timed paper section',      duration: 45, category: 'Timed Practice' },
  ],
  // IPMAT is a timing game as much as an aptitude one — timed tasks are
  // first-class here, not an afterthought tacked onto the end.
  IPMAT: [
    { id: 'ipmat-1', title: '20 Quantitative Ability questions',   duration: 30, category: 'Aptitude' },
    { id: 'ipmat-2', title: '20 Verbal Ability questions',         duration: 30, category: 'Aptitude' },
    { id: 'ipmat-3', title: '10 timed QA questions',               duration: 15, category: 'Timed Practice' },
    { id: 'ipmat-4', title: 'Read and summarize one editorial/article', duration: 20, category: 'Verbal' },
    { id: 'ipmat-5', title: 'Review your error log',               duration: 15, category: 'Revision' },
    { id: 'ipmat-6', title: 'Complete one timed sectional',        duration: 40, category: 'Timed Practice' },
    { id: 'ipmat-7', title: 'Analyze one mock',                    duration: 30, category: 'Analysis' },
  ],
};

// Boards tasks are study habits (chapter targets, recall, error logs, timed
// sections), not subject lists — the same set fits Science, Commerce and
// Humanities equally well, so all three streams share BASE_TASKS.CLASS12.
const CLASS12_STREAM_TASKS: Record<ClassTwelveStream, Task[]> = {
  Science: BASE_TASKS.CLASS12,
  Commerce: BASE_TASKS.CLASS12,
  Humanities: BASE_TASKS.CLASS12,
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
