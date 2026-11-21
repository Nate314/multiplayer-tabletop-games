import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to TeamPicker.tsx (the role buttons, Even out), ClueForm.tsx (Clue, Number, Give clue; the form's
// Enter), Grid.tsx (the word cards), ClueLine.tsx (End guessing) and GameScreen.tsx (Undo)
export const CONTROLS: ControlItem[] = [
  {
    action: 'Pick your team and role',
    pointer: 'Before the game starts, click or tap Be Red\'s clue-giver, Guess for Red, Be Blue\'s clue-giver or Guess for Blue. You can change your pick until the game starts.'
  },
  { action: 'Balance the teams', pointer: 'Before the game starts, click or tap Even out.' },
  {
    action: 'Give a clue',
    pointer: 'As your team\'s clue-giver, type one word in Clue, choose a number in Number, then click or tap Give clue.',
    keys: 'In Clue, Enter gives the clue.'
  },
  { action: 'Guess a word', pointer: 'As a guesser on the team whose turn it is, click or tap a word that is still face down.' },
  { action: 'Stop guessing', pointer: 'After you have turned over a word, click or tap End guessing.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if everyone else approves.' }
];
