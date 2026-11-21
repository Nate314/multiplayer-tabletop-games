import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to AnswerSheet.tsx (the text boxes and Done; the form ignores Enter) and ReviewTable.tsx (Challenge, Keep,
// Reject, Continue)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Write an answer',
    pointer: 'Click or tap a category\'s box and type, up to 40 characters. Your text is sent as you type, and when you leave the box.'
  },
  { action: 'Finish early', pointer: 'Click or tap Done. Your boxes are locked once you have.' },
  { action: 'Challenge an answer', pointer: 'In the review, click or tap Challenge on another player\'s scoring answer.' },
  { action: 'Judge a challenged answer', pointer: 'Click or tap Keep or Reject on the challenged answer.' },
  { action: 'Go on to the next round', pointer: 'In the review, click or tap Continue.' }
];
