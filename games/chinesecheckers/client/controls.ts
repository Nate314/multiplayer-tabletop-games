import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (handleHoleClick, End move, Undo) and Board.tsx (the keyboard handlers on marbles and landing holes)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Pick a marble',
    pointer: 'On your turn, click or tap one of your glowing marbles. The holes it can reach are marked.',
    keys: 'Tab to a glowing marble, then Enter or Space.'
  },
  {
    action: 'Move to a marked hole',
    pointer: 'Click or tap a marked hole. A step to an adjacent hole is sent at once.',
    keys: 'Tab to the marked hole, then Enter or Space.'
  },
  { action: 'Hop again in a chain', pointer: 'After a hop, click or tap the next marked hole to keep going.', keys: 'Tab to the next marked hole, then Enter or Space.' },
  { action: 'Stop a chain of hops', pointer: 'Click or tap End move.' },
  {
    action: 'Let go of the picked marble, or choose another',
    pointer: 'Click or tap the picked marble again to let it go, or another of your marbles to pick that one instead.',
    keys: 'Tab to the marble, then Enter or Space.'
  },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
