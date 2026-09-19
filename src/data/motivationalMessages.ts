// Content bank for the daily in-app motivational postcard (see
// MotivationalPostcard.tsx). `template` uses `{{...}}` to mark the phrase
// that renders in the accent orange — everything else renders as plain
// text. The literal token `{{GOAL}}` is special-cased by the renderer: it's
// substituted with the user's own futureGoal.text (falling back to "your
// goal" when they never set one) instead of being rendered literally.
export interface MotivationalMessage {
  id: number;
  template: string;
}

export const MOTIVATIONAL_MESSAGES: MotivationalMessage[] = [
  { id: 1, template: "Small steps still move you {{closer}}." },
  { id: 2, template: "Show up today. That's what builds {{tomorrow}}." },
  { id: 3, template: "Your future self is already cheering {{for you}}." },
  { id: 4, template: "Give your best. That's always {{enough}}." },
  { id: 5, template: "Discipline now. More {{freedom later}}." },
  { id: 6, template: "Pressure today can build a {{stronger}} you tomorrow." },
  { id: 7, template: "Excuses don't get you {{closer}}." },
  { id: 8, template: "Protect your {{focus}}. It's more valuable than you think." },
  { id: 9, template: "Remember why you {{started}}." },
  { id: 10, template: "You're making {{progress}}, even when it feels slow." },
  { id: 11, template: "One focused hour can change {{everything}}." },
  { id: 12, template: "You are capable of {{more}} than you think." },
  { id: 13, template: "A bad day is just a pause, {{not the end}}." },
  { id: 14, template: "Choose {{effort}} over comfort." },
  { id: 15, template: "The life you want is on the other side of {{consistency}}." },
  { id: 16, template: "You don't need to be perfect. You just need to {{show up}}." },
  { id: 17, template: "Make this version of you {{proud}}." },
  { id: 18, template: "Distractions are loud. But your goals matter {{more}}." },
  { id: 19, template: "You're {{closer}} than you think." },
  { id: 20, template: "Effort today creates {{options}} tomorrow." },
  { id: 21, template: "Do it now. Your future will {{thank you}}." },
  { id: 22, template: "It's not about being the best today. It's about being {{better than yesterday}}." },
  { id: 23, template: "You have what it takes. {{Keep going}}." },
  { id: 24, template: "The hard days are shaping a {{stronger, smarter}} you." },
  { id: 25, template: "Less scrolling. More of {{what matters}}." },
  { id: 26, template: "This time, you give it {{everything}}." },
  { id: 27, template: "Believe in what you're {{building}}." },
  { id: 28, template: "You have a goal for a {{reason}}." },
  { id: 29, template: "Progress looks different on everyone. {{Keep going anyway}}." },
  { id: 30, template: "One day, all this effort will {{make sense}}." },
  { id: 31, template: "You're one step closer to {{GOAL}}." },
  { id: 32, template: "You're {{closer to your goal}} every time you show up." },
  { id: 33, template: "Make your future self {{proud}} that you gave it all you could." },
  { id: 34, template: "You'll see {{magic}} when you give everything." },
  { id: 35, template: "You've got this — {{every day}}." },
  { id: 36, template: "Diamonds are made under {{pressure}}." },
  { id: 37, template: "If you want it bad enough, you'll find a {{way}}. If you don't, you'll find an {{excuse}}." },
  { id: 38, template: "Every time you show up, you're getting {{closer}}." },
  { id: 39, template: "You didn't come this far just to {{come this far}}." },
  { id: 40, template: "Losing sleep for your goals is better than {{dreaming about them}}." },
  { id: 41, template: "Show them what you're {{capable of}}." },
  { id: 42, template: "Today is another step toward {{the life you want}}." },
  { id: 43, template: "One day, you'll look back and be {{glad you kept going}}." },
  { id: 44, template: "The days you don't feel like it {{matter the most}}." },
  { id: 45, template: "Give it {{everything you've got}}." },
  { id: 46, template: "If you were 15 failures away from your goal, would you {{fail 15 times}}?" },
];
