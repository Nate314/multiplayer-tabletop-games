import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (hand cards, Sort, Discard, Deselect, Undo), Piles.tsx (the two piles),
// LayDownPanel.tsx (phase picker, Add selected, staged cards, Lay down phase, Clear), Table.tsx (Hit here) and
// src/components/RoundSummaryDialog.tsx via HandSummary.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Draw a card',
    pointer: 'On your turn, click or tap the draw pile, or the top of the discard pile. A Skip on the discard pile cannot be taken.'
  },
  { action: 'Sort your hand', pointer: 'Click or tap Number or Color above your hand.' },
  {
    action: 'Pick cards',
    pointer: 'After drawing, click or tap cards in your hand to pick them, and a picked card again to unpick it. ' +
      'Click or tap Deselect to unpick them all.'
  },
  {
    action: 'Choose a phase to lay down',
    pointer: 'With the Phases in any order house rule, before you lay down, pick a phase in the Phase to lay down list. ' +
      'Changing it clears the cards you have put in groups.'
  },
  {
    action: 'Build your phase',
    pointer: 'Before you lay down, pick cards, then click or tap Add selected to group 1 (or group 2). ' +
      'Click or tap a card in a group to put it back in your hand, or Clear to put them all back.'
  },
  { action: 'Lay down your phase', pointer: 'Click or tap Lay down phase, once every group is right.' },
  {
    action: 'Hit a group',
    pointer: 'After your phase is down, pick the cards to add, then click or tap Hit here on a group on the table.'
  },
  {
    action: 'Discard a card',
    pointer: 'Pick one card, then click or tap Discard selected card. For a Skip, click or tap Discard Skip on the player who loses a turn.'
  },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' },
  { action: 'Go on to the next hand', pointer: 'Click or tap Continue on the scoring screen.' }
];
