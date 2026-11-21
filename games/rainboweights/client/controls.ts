import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (hand cards, Draw, Pass, Last card!, Catch, Challenge, Accept, the color and swap
// pickers, Undo), Table.tsx (the draw pile button) and src/components/RoundSummaryDialog.tsx via RoundSummary.tsx (Continue)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Name the first color',
    pointer: 'If the game starts on a Wild, the player to the dealer\'s left clicks or taps a color before playing.'
  },
  {
    action: 'Play a card',
    pointer: 'On your turn, click or tap a playable card in your hand. Playable cards are raised and outlined.'
  },
  {
    action: 'Play a Wild',
    pointer: 'Click or tap the Wild, then the color you want. Click or tap Cancel to put the Wild back.'
  },
  {
    action: 'Swap hands with a 7',
    pointer: 'With the 7-0 house rule, click or tap the 7, then the name of the player to swap with. Click or tap Cancel to put the 7 back.'
  },
  {
    action: 'Jump in',
    pointer: 'With the jump-in house rule, out of turn, click or tap a card of exactly the same color and number as the top card.'
  },
  {
    action: 'Draw a card',
    pointer: 'On your turn, click or tap Draw or the draw pile. With the drawing until you can play house rule, one click takes cards until one can be played.'
  },
  { action: 'Keep a drawn card', pointer: 'After drawing, click or tap Pass to keep the card instead of playing it.' },
  {
    action: 'Call Last card',
    pointer: 'With two cards in hand, click or tap Last card! before playing your next-to-last card. Click or tap it again to take the call back. ' +
      'If you forgot, click or tap it right after you play.'
  },
  { action: 'Catch a missed Last card', pointer: 'Click or tap Catch, before the next player moves.' },
  {
    action: 'Answer a Wild Draw Four',
    pointer: 'Click or tap Accept and draw, or Challenge. With the stacking house rule you can also play a stackable card instead.'
  },
  { action: 'Answer a stack of draws', pointer: 'With the stacking house rule, click or tap a card that stacks, or Accept and draw.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every player still in the game approves.' },
  { action: 'Go on to the next round', pointer: 'Click or tap Continue on the scoring screen.' }
];
