// Exam dates, in one place. Used by the Today screen's countdown cards and by
// the block screen (through setExamCountdowns in utils/appBlocking.ts).
//
// An event with a `start` gets a live countdown. One without it says "Not
// announced" (or the tentative note) until the date is published; fill in
// `start`/`end`/`dateText` here and it starts counting, no other change.
import type { CustomExam } from './examPresets';

export interface ExamEvent {
  id: string;
  /** Full name, shown on the Today card. */
  label: string;
  /** Short name for the block screen. */
  short: string;
  /** First exam day (9:00 IST). Missing = not announced yet. */
  start?: Date;
  /** Last exam day, for exams spread over several days. */
  end?: Date;
  /** The dates as written for people ("Jan 20, 21, 22, 23, 24 & 28, 2027"), or
   *  the note shown instead of a countdown ("Not announced"). */
  dateText: string;
}

const NOT_ANNOUNCED = 'Not announced';
const at = (ymd: string) => new Date(`${ymd}T09:00:00+05:30`);

export const EXAM_EVENTS: Record<string, ExamEvent[]> = {
  JEE: [
    { id: 'jee-main-1', label: 'JEE Main 2027 · Session 1', short: 'JEE Main (Session 1)', start: at('2027-01-20'), end: at('2027-01-28'), dateText: 'Jan 20, 21, 22, 23, 24 & 28, 2027' },
    { id: 'jee-main-2', label: 'JEE Main 2027 · Session 2', short: 'JEE Main (Session 2)', start: at('2027-04-02'), end: at('2027-04-07'), dateText: 'Apr 2, 3, 4, 5, 6 & 7, 2027' },
    { id: 'jee-adv', label: 'JEE Advanced 2027', short: 'JEE Advanced', dateText: NOT_ANNOUNCED },
  ],
  NEET: [
    { id: 'neet', label: 'NEET UG 2027', short: 'NEET UG', dateText: NOT_ANNOUNCED },
  ],
  CLASS10: [
    { id: 'cbse10', label: 'CBSE Class 10 · 2027', short: 'CBSE Class 10', dateText: NOT_ANNOUNCED },
    { id: 'tn10', label: 'Tamil Nadu State Board Class 10 · 2027', short: 'TN Class 10', start: at('2027-03-17'), end: at('2027-04-04'), dateText: 'Mar 17 – Apr 4, 2027 (theory)' },
  ],
  CLASS12: [
    { id: 'cbse12', label: 'CBSE Class 12 · 2027', short: 'CBSE Class 12', dateText: NOT_ANNOUNCED },
    { id: 'tn12', label: 'Tamil Nadu State Board Class 12 · 2027', short: 'TN Class 12', start: at('2027-03-03'), end: at('2027-03-29'), dateText: 'Mar 3 – Mar 29, 2027' },
  ],
  UCEED: [
    { id: 'uceed', label: 'UCEED 2027', short: 'UCEED', start: at('2027-01-17'), dateText: 'Jan 17, 2027' },
  ],
  NID: [
    { id: 'nid-prelims', label: 'NID DAT 2027 · Prelims', short: 'NID DAT Prelims', start: at('2026-12-20'), dateText: 'Dec 20, 2026' },
    { id: 'nid-mains', label: 'NID DAT 2027 · Mains', short: 'NID DAT Mains', dateText: NOT_ANNOUNCED },
  ],
  NIFT: [
    { id: 'nift', label: 'NIFT / NIFTEE 2027', short: 'NIFT', dateText: 'Tentative: March–April 2027. Exact date not announced' },
  ],
  IPMAT: [
    { id: 'ipmat-indore', label: 'IPMAT Indore 2027', short: 'IPMAT Indore', dateText: NOT_ANNOUNCED },
    { id: 'ipmat-rohtak', label: 'IPMAT Rohtak 2027', short: 'IPMAT Rohtak', dateText: NOT_ANNOUNCED },
  ],
};

const DAY_MS = 86_400_000;

/** Still worth showing: no date yet, or the last exam day is not over. */
export function isOpenEvent(e: ExamEvent, now = Date.now()): boolean {
  if (!e.start) return true;
  return now < (e.end ?? e.start).getTime() + DAY_MS;
}

/** The events to show for the exams a person picked, dated ones first (nearest
 *  first), then the ones still without a date. */
export function eventsFor(examTypes: string[] | undefined, now = Date.now()): ExamEvent[] {
  const out: ExamEvent[] = [];
  for (const id of examTypes ?? []) for (const e of EXAM_EVENTS[id] ?? []) if (isOpenEvent(e, now)) out.push(e);
  const dated = out.filter(e => e.start).sort((a, b) => a.start!.getTime() - b.start!.getTime());
  return [...dated, ...out.filter(e => !e.start)];
}

export interface ExamCountdownItem {
  name: string;
  /** Exam day in ms. 0 = no countdown, show `note` instead. */
  atMs: number;
  note?: string;
}

/** What the block screen shows, for the exams the person picked (and their own
 *  custom exam with its date). Saved on the phone; the days are counted when
 *  the block screen appears. */
export function examCountdownItems(examTypes: string[] | undefined, customExam?: CustomExam | null, now = Date.now()): ExamCountdownItem[] {
  const items: ExamCountdownItem[] = [];
  for (const e of eventsFor(examTypes, now)) {
    if (e.start && e.start.getTime() > now) items.push({ name: e.short, atMs: e.start.getTime() });
    else if (e.start) items.push({ name: e.short, atMs: 0, note: 'on now' });
    else items.push({ name: e.short, atMs: 0, note: e.id === 'nift' ? 'tentative, March–April 2027' : 'not announced' });
  }
  if (customExam?.name && customExam.date) {
    const t = new Date(`${customExam.date}T09:00:00`).getTime();
    if (Number.isFinite(t) && t > now) items.unshift({ name: customExam.name, atMs: t });
  }
  // Dated first, nearest first; the rest keep their order.
  const dated = items.filter(i => i.atMs > 0).sort((a, b) => a.atMs - b.atMs);
  return [...dated, ...items.filter(i => i.atMs === 0)];
}
