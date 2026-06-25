import { Task, ExamType } from '../types';

type TaskTemplate = Omit<Task, 'id' | 'status'>;

const UCEED_TASKS: TaskTemplate[] = [
  { emoji: '✏️', title: 'Sketching practice', cat: 'drawing', dur: 45, repeat: 'daily' },
  { emoji: '🎨', title: 'Colour theory exercise', cat: 'drawing', dur: 30, repeat: 'daily' },
  { emoji: '🔲', title: 'Visual design quiz', cat: 'aptitude', dur: 20, repeat: 'daily' },
  { emoji: '📐', title: 'Perspective drawing', cat: 'drawing', dur: 30, repeat: 'daily' },
  { emoji: '📚', title: 'Design history reading', cat: 'theory', dur: 20, repeat: 'daily' },
  { emoji: '🧩', title: 'Spatial reasoning puzzles', cat: 'aptitude', dur: 25, repeat: 'daily' },
  { emoji: '💡', title: 'Innovation case study', cat: 'theory', dur: 20, repeat: 'daily' },
  { emoji: '🏃', title: 'Physical exercise', cat: 'health', dur: 30, repeat: 'daily' },
];

const NID_TASKS: TaskTemplate[] = [
  { emoji: '✏️', title: 'Sketching practice', cat: 'drawing', dur: 60, repeat: 'daily' },
  { emoji: '🖌️', title: 'Rendering & shading', cat: 'drawing', dur: 45, repeat: 'daily' },
  { emoji: '🧱', title: '3D form studies', cat: 'drawing', dur: 30, repeat: 'daily' },
  { emoji: '📖', title: 'Design theory reading', cat: 'theory', dur: 25, repeat: 'daily' },
  { emoji: '🌍', title: 'GK & current affairs', cat: 'aptitude', dur: 20, repeat: 'daily' },
  { emoji: '🏃', title: 'Physical exercise', cat: 'health', dur: 30, repeat: 'daily' },
];

const NIFT_TASKS: TaskTemplate[] = [
  { emoji: '👗', title: 'Fashion illustration', cat: 'drawing', dur: 45, repeat: 'daily' },
  { emoji: '🎨', title: 'Colour & texture study', cat: 'drawing', dur: 30, repeat: 'daily' },
  { emoji: '✂️', title: 'Garment construction', cat: 'theory', dur: 25, repeat: 'daily' },
  { emoji: '📰', title: 'Fashion trend analysis', cat: 'theory', dur: 20, repeat: 'daily' },
  { emoji: '🧠', title: 'Reasoning practice', cat: 'aptitude', dur: 25, repeat: 'daily' },
  { emoji: '🏃', title: 'Physical exercise', cat: 'health', dur: 30, repeat: 'daily' },
];

const JEE_TASKS: TaskTemplate[] = [
  { emoji: '📐', title: 'Maths problems', cat: 'aptitude', dur: 60, repeat: 'daily' },
  { emoji: '⚗️', title: 'Chemistry revision', cat: 'theory', dur: 45, repeat: 'daily' },
  { emoji: '🔭', title: 'Physics problems', cat: 'aptitude', dur: 45, repeat: 'daily' },
  { emoji: '📝', title: 'Mock test practice', cat: 'aptitude', dur: 30, repeat: 'daily' },
  { emoji: '🏃', title: 'Physical exercise', cat: 'health', dur: 30, repeat: 'daily' },
];

const EXAM_TASKS: Record<ExamType, TaskTemplate[]> = {
  UCEED: UCEED_TASKS,
  NID: NID_TASKS,
  NIFT: NIFT_TASKS,
  JEE: JEE_TASKS,
};

export const EXAM_COUNTDOWNS: Record<ExamType, string> = {
  UCEED: '2027-01-17',
  NID: '2026-12-21',
  NIFT: '2027-02-08',
  JEE: '2027-04-06',
};

export function generateTasksForExams(exams: ExamType[]): Task[] {
  const seen = new Set<string>();
  const tasks: Task[] = [];
  for (const exam of exams) {
    for (const template of EXAM_TASKS[exam] ?? []) {
      if (!seen.has(template.title)) {
        seen.add(template.title);
        tasks.push({
          ...template,
          id: `${Date.now()}-${Math.random()}`,
          status: 'upcoming',
        });
      }
    }
  }
  return tasks;
}
