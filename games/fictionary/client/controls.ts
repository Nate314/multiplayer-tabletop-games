import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to WritingPanel.tsx (the definition box, Submit or Update), VotingPanel.tsx (the choices)
// and GameScreen.tsx with src/components/RoundSummaryDialog.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  { action: 'Write a definition', pointer: 'Click or tap the box labelled Your definition, type up to 150 characters, then click or tap Submit.' },
  { action: 'Change your definition', pointer: 'While writing is open, type a new one and click or tap Update.' },
  { action: 'Vote for the real definition', pointer: 'Click or tap a definition. Your own is marked Yours and cannot be picked. Click or tap another to change your vote while voting is open.' },
  { action: 'Move on after a reveal', pointer: 'Click or tap Continue in the reveal.' }
];
