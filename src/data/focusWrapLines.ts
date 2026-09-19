// Content bank for the weekly/monthly "Focus Wrap" (Spotify-Wrapped-style
// report) — not yet built as a screen. Banked here so the copy is ready to
// wire in once that screen exists. Same `{{...}}` convention as
// motivationalMessages.ts: everything inside renders in the accent orange.
// Tokens in ALL_CAPS (TOTAL_TIME, SESSION_COUNT, ...) are placeholders for
// real stats — substitute them the same way {{GOAL}} is handled for
// postcards, rather than rendering the token literally.
export interface FocusWrapLine {
  id: number;
  template: string;
}

export const FOCUS_WRAP_LINES: FocusWrapLine[] = [
  { id: 1, template: "Your {{PERIOD}} in focus starts now." },
  { id: 2, template: "{{TOTAL_TIME}}. Time you chose over everything else." },
  { id: 3, template: "{{SESSION_COUNT}} times you picked focus over the feed." },
  { id: 4, template: "{{DAYS_SHOWN_UP}} days. You kept a promise to yourself." },
  { id: 5, template: "Longest session: {{LONGEST_SESSION}}. You went all in." },
  { id: 6, template: "{{STREAK}}-day streak. That's not luck, that's you." },
  { id: 7, template: "{{PERCENT_CHANGE}}% more focused than last {{PERIOD}}." },
  { id: 8, template: "{{DISTRACTIONS_BLOCKED}} distractions stopped. Focus, undisturbed." },
  { id: 9, template: "{{TIME_AWAY}} that went to you, not your feed." },
  { id: 10, template: "You're {{PERCENT_TO_GOAL}}% closer to {{GOAL}} than when you started." },
  { id: 11, template: "New personal best: {{RECORD}}. You outdid yourself." },
  { id: 12, template: "{{COMPLETED_SESSIONS}} of {{PLANNED_SESSIONS}} sessions. You still showed up." },
  { id: 13, template: "You could've scrolled. You locked in instead." },
  { id: 14, template: "Not every session was long. Every one counted." },
  { id: 15, template: "{{LOW_MOTIVATION_SESSIONS}} sessions you almost skipped — and didn't." },
  { id: 16, template: "Discipline isn't loud. It's just showing up again." },
  { id: 17, template: "You're proof that consistency beats motivation." },
  { id: 18, template: "Momentum doesn't need motivation. It needs repetition." },
  { id: 19, template: "{{GOAL}} isn't as far as it used to be." },
  { id: 20, template: "The story's not over. Neither are you." },
];
