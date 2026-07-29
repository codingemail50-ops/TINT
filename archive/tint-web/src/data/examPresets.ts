export interface Task {
  id: string
  title: string
  duration: number
  category: string
  isCustom?: boolean
  completed?: boolean
  completedAt?: string
  repeat?: boolean
}

export const EXAM_TYPES = [
  { id: 'JEE', label: 'JEE', emoji: '⚗️', color: '#7C3AED', description: 'Maths · Physics · Chemistry' },
  { id: 'UCEED', label: 'UCEED', emoji: '✏️', color: '#0EA5E9', description: 'Drawing · Design · Visual' },
  { id: 'NID', label: 'NID', emoji: '🎨', color: '#EC4899', description: 'Studio Drawing · Design Aptitude' },
  { id: 'NIFT', label: 'NIFT', emoji: '👗', color: '#F59E0B', description: 'Fashion · Creative Ability' },
]

const BASE_TASKS: Record<string, Task[]> = {
  JEE: [
    { id: 'jee-math', title: 'Mathematics Practice', duration: 90, category: 'Math' },
    { id: 'jee-physics', title: 'Physics Problems', duration: 60, category: 'Physics' },
    { id: 'jee-chemistry', title: 'Chemistry Concepts', duration: 60, category: 'Chemistry' },
    { id: 'jee-pyqs', title: 'Previous Year Questions', duration: 45, category: 'PYQs' },
    { id: 'jee-revision', title: 'Formula Revision', duration: 30, category: 'Revision' },
  ],
  UCEED: [
    { id: 'uceed-drawing', title: 'Observational Drawing', duration: 60, category: 'Drawing' },
    { id: 'uceed-visual', title: 'Visual Design Study', duration: 45, category: 'Visual Design' },
    { id: 'uceed-spatial', title: 'Spatial Reasoning Practice', duration: 30, category: 'Spatial' },
    { id: 'uceed-theory', title: 'Design Theory Reading', duration: 30, category: 'Design Theory' },
    { id: 'uceed-portfolio', title: 'Portfolio Development', duration: 60, category: 'Portfolio' },
  ],
  NID: [
    { id: 'nid-studio', title: 'Studio Drawing Session', duration: 90, category: 'Studio Drawing' },
    { id: 'nid-memory', title: 'Memory Drawing Practice', duration: 45, category: 'Memory Drawing' },
    { id: 'nid-aptitude', title: 'Design Aptitude Problems', duration: 30, category: 'Design Aptitude' },
    { id: 'nid-history', title: 'Design History Study', duration: 30, category: 'Design History' },
    { id: 'nid-creative', title: 'Creative Exploration', duration: 60, category: 'Creative Exploration' },
  ],
  NIFT: [
    { id: 'nift-illustration', title: 'Fashion Illustration', duration: 60, category: 'Fashion Illustration' },
    { id: 'nift-cat', title: 'Creative Ability Test Prep', duration: 45, category: 'Creative Ability' },
    { id: 'nift-gat', title: 'General Ability Test Study', duration: 45, category: 'General Ability' },
    { id: 'nift-design', title: 'Design Theory Review', duration: 30, category: 'Design Theory' },
    { id: 'nift-situation', title: 'Situation Test Practice', duration: 60, category: 'Situation Test' },
  ],
}

export function getCombinedPreset(examTypes: string[]): Task[] {
  const seen = new Set<string>()
  const tasks: Task[] = []

  for (const exam of examTypes) {
    const examTasks = BASE_TASKS[exam] || []
    for (const task of examTasks) {
      if (!seen.has(task.category) && tasks.length < 8) {
        seen.add(task.category)
        tasks.push({ ...task, completed: false })
      }
    }
  }

  return tasks
}

export const MOTIVATIONAL_QUOTES = [
  { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { quote: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { quote: 'Success is not final, failure is not fatal. It is the courage to continue that counts.', author: 'Winston Churchill' },
  { quote: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
  { quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { quote: 'Don\'t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
  { quote: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
  { quote: 'Hard work beats talent when talent doesn\'t work hard.', author: 'Tim Notke' },
  { quote: 'Push yourself, because no one else is going to do it for you.', author: 'Unknown' },
  { quote: 'Great things never come from comfort zones.', author: 'Unknown' },
]

export const REALITY_CHECK_MESSAGES = [
  { threshold: 0, message: 'You haven\'t started yet. Every journey begins with a single step.', color: '#6060A0' },
  { threshold: 20, message: 'A slow start is still a start. Build the habit, one day at a time.', color: '#EF4444' },
  { threshold: 40, message: 'You\'re building momentum! Keep showing up consistently.', color: '#F59E0B' },
  { threshold: 60, message: 'Solid consistency! You\'re ahead of most. Don\'t stop now.', color: '#10B981' },
  { threshold: 80, message: 'Exceptional dedication! You\'re in the top tier. Stay there.', color: '#7C3AED' },
]

export const AVATARS = [
  '🎯', '🔥', '⚡', '🧠', '🏆',
  '🚀', '💎', '🦁', '⚔️', '🐉',
  '🌟', '💫', '🦋', '🌙', '☄️',
  '💡', '🔬', '⚗️', '🎮', '🦊',
]
