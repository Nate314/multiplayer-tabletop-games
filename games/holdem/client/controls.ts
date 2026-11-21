import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (Fold, Check, Call, Amount, Bet or Raise to, All in, Undo, Continue, the end vote)
export const CONTROLS: ControlItem[] = [
  { action: 'Fold', pointer: 'On your turn, click or tap Fold.' },
  { action: 'Check or call', pointer: 'On your turn, click or tap Check when there is nothing to call, or Call with the amount.' },
  {
    action: 'Bet or raise',
    pointer: 'On your turn, type the total in Amount, then click or tap Bet or Raise to. ' +
      'Amount starts at the smallest bet or raise you may make.'
  },
  { action: 'Go all in', pointer: 'On your turn, click or tap All in.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  {
    action: 'Go on to the next hand',
    pointer: 'If you still have chips, click or tap Continue under the hand result.'
  },
  {
    action: 'Vote to end the game',
    pointer: 'If you still have chips, click or tap Vote to end the game under the hand result, or Take back my vote to end.'
  }
];
