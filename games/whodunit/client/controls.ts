import type { ControlItem } from '../../../src/clientGames.ts';

// Each row is traced to GameScreen.tsx (the turn buttons and Undo), Board.tsx (the squares and rooms to move to),
// CardPicker.tsx (suggest and accuse), ShowPrompt.tsx (showing a card) and NotesSheet.tsx (the marks)
export const CONTROLS: ControlItem[] = [
  { action: 'Roll the dice', pointer: 'At the start of your turn, click or tap Roll.' },
  { action: 'Take a secret passage', pointer: 'At the start of your turn, in a corner room with a passage, click or tap Secret passage instead of rolling.' },
  { action: 'Stay in the room you were moved to', pointer: 'At the start of your turn, after a suggestion moved you, click or tap Stay in and the room name.' },
  { action: 'Move after rolling', pointer: 'Click or tap one of the highlighted squares or rooms on the board.' },
  { action: 'Stay put', pointer: 'When the roll leads nowhere, click or tap Stay put.' },
  {
    action: 'Make a suggestion',
    pointer: 'On entering a room, click or tap Suggest, pick a suspect and an object from the lists, then click or tap Make suggestion. Cancel backs out.'
  },
  { action: 'Show a card to the suggester', pointer: 'When the game asks you, click or tap one of your cards that match the suggestion.' },
  {
    action: 'Make an accusation',
    pointer: 'At the start of your turn or after moving, click or tap Accuse, pick a suspect, an object and a room, click or tap Make accusation, then Yes, accuse. Back and Cancel back out.'
  },
  { action: 'End your turn', pointer: 'Click or tap End turn.' },
  { action: 'Mark a card in your notes', pointer: 'Click or tap the box beside a card to cycle it through blank, yes, no and maybe.' },
  { action: 'Ask to take back the last move', pointer: 'Click or tap Undo. It happens only if every connected player approves.' }
];
