// Copy for the 7 Day Lock In, written to the emotional curve of the week:
//  - Day 1: motivation is high, but the most hooked people feel it hardest.
//    The more often they try to open a blocked app today, the rawer the
//    message gets.
//  - Days 2-3: the real urge kicks in for everyone.
//  - Days 4-5: the end feels far away. Frame it as half full, not half empty.
//  - Day 6: needs a push. Day 7: carries itself.

export const DAY_QUOTES: Record<number, string[]> = {
  1: [
    "Day 1. It's just one day. Win this one.",
    'The urge will come. Let it pass. It always does.',
    'You picked this. Future you is already grateful.',
  ],
  2: [
    'Day 2 is where most people break. You are not most people.',
    'This is the hardest day of the week. Get through it and the rest gets easier.',
    "Your thumb remembers the scroll. Your brain doesn't need it.",
  ],
  3: [
    'The noise is getting quieter. Keep going.',
    'Three days in. The habit is already loosening its grip.',
    'Bored? Good. Boredom is where your best ideas live.',
  ],
  4: [
    "More than halfway by tonight. Don't hand it back now.",
    "You've already done the hardest days. This is the downhill.",
    'Three days done. You are closer to the finish than the start.',
  ],
  5: [
    'Five days. Most people never get here.',
    "Look at what you've already built. Two more days protect it.",
    "The hard part is behind you. Now it's just showing up.",
  ],
  6: [
    'One more push. Tomorrow you finish.',
    "Don't quit on the second-last day. That's the story no one wants.",
    'Six days of proof that you can. Finish strong.',
  ],
  7: [
    'Last day. Finish it.',
    "Tonight you get to say you did it. Don't trade that for a reel.",
    'Seven days. Locked in. Almost there.',
  ],
};

// Day 1 only: shown instead of the normal line once the urges pile up.
const DAY_ONE_HEAVY: string[] = [
  "That's a lot of urges. Each one you skip makes the next one weaker.",
  'Your brain is asking for the hit. You are saying no. That is the whole game.',
  'Every blocked tap today is a rep. You are getting stronger.',
];

const DAY_ONE_HEAVY_AT = 10;

/** The quote for the main screen. Stable within an hour so it doesn't
 *  change on every re-render. */
export function quoteFor(day: number, urgesToday: number, nowMs: number): string {
  const hour = Math.floor(nowMs / 3_600_000);
  const pool = day === 1 && urgesToday >= DAY_ONE_HEAVY_AT
    ? DAY_ONE_HEAVY
    : DAY_QUOTES[Math.min(Math.max(day, 1), 7)];
  return pool[hour % pool.length];
}

/** Half-full framing for the progress line under the bar. */
export function progressLine(day: number): string {
  switch (day) {
    case 1: return 'Day 1 of 7. Just get through today.';
    case 2: return '1 day down. The hardest day is today.';
    case 3: return '2 days down. The worst is behind you.';
    case 4: return '3 days down. Halfway there tonight.';
    case 5: return '4 days down. Only 3 to go.';
    case 6: return '5 days down. One more push.';
    default: return '6 days down. Finish it today.';
  }
}

/** Wording for the completion screen. Each person is assigned one (see
 *  getWinVariant in utils/challenge.ts) and keeps it. Only the words vary. */
export const WIN_VARIANTS: { headline: string; line: string }[] = [
  {
    headline: 'YOU SAID YOU WOULD. YOU DID.',
    line: 'You kept a promise to yourself for seven straight days. Let that sink in.',
  },
  {
    headline: 'YOU PROVED IT TO YOURSELF.',
    line: "Seven days. Locked in. You showed yourself what you're capable of.",
  },
  {
    headline: 'YOU HAD THE URGE. YOU HAD THE CONTROL.',
    line: "Seven days of choosing differently. That's a win worth celebrating.",
  },
  {
    headline: 'SEVEN DAYS. NO EXCUSES. ALL YOU.',
    line: 'Nobody did it for you. You showed up every single day.',
  },
];

export interface ChallengeNotificationCopy { title: string; body: string }

/** Morning and evening local notifications, per day. */
export const DAY_NOTIFICATIONS: Record<number, { am: ChallengeNotificationCopy; pm: ChallengeNotificationCopy }> = {
  1: {
    am: { title: 'Day 1. Lock in.', body: 'No reels today. Just win this one day.' },
    pm: { title: 'Day 1 almost done', body: "You're one sleep away from Day 2. Don't break it now." },
  },
  2: {
    am: { title: 'Day 2 is the hard one', body: "Most people break today. You won't." },
    pm: { title: 'You survived Day 2', body: 'The hardest day of the week is nearly behind you.' },
  },
  3: {
    am: { title: 'Day 3', body: 'The urge is quieter today. Keep it that way.' },
    pm: { title: '3 days down tonight', body: 'Almost halfway. Keep going.' },
  },
  4: {
    am: { title: 'Day 4. Halfway.', body: "You've done the hardest part already." },
    pm: { title: 'Past halfway', body: "You're closer to the finish than the start." },
  },
  5: {
    am: { title: 'Day 5', body: 'Most people never get this far. You did.' },
    pm: { title: '5 days down', body: 'Two more days protect everything you built.' },
  },
  6: {
    am: { title: 'Day 6. One more push.', body: 'Tomorrow you finish. Stay locked in today.' },
    pm: { title: 'Last night before the finish', body: 'One more day. You have got this.' },
  },
  7: {
    am: { title: 'Final day', body: 'Finish it. Tonight you get to say you did it.' },
    pm: { title: 'Almost there', body: 'A few more hours. Stay locked in.' },
  },
};
