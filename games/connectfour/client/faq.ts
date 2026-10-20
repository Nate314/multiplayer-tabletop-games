import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Connect Four is ' +
      'for exactly two players, and nobody can join after the first move. The first player plays Red and moves ' +
      'first; the second plays Yellow.'
  },
  {
    question: 'How do I drop a disc?',
    answer: 'On your turn, click the arrow above a column, or click anywhere in the column. The disc falls to the ' +
      'lowest empty cell. A full column cannot be chosen, and its arrow is greyed out.'
  },
  {
    question: 'How do I win?',
    answer: 'Be the first to line up four of your discs in a row: across, up and down, or diagonally. The winning ' +
      'four are highlighted.'
  },
  {
    question: 'Can the game be drawn?',
    answer: 'Yes. If the board fills up with no four in a row, the game is a draw. You can also agree to a draw: ' +
      'click Offer draw at any time; your opponent sees Accept draw and Decline. The offer lapses if they decline ' +
      'or make a move instead.'
  },
  {
    question: 'How do I resign?',
    answer: 'At any time, on either player\'s turn, click Resign and then Confirm resign. Your opponent wins. ' +
      'Click Keep playing to change your mind.'
  },
  {
    question: 'What does Undo do?',
    answer: 'Undo asks your opponent to take back the last disc; it happens only if they approve.'
  },
  {
    question: 'What is highlighted on the board?',
    answer: 'The last disc dropped is outlined in yellow, and the winning four glow green. The board is dimmed ' +
      'when it is not your turn.'
  },
  {
    question: 'What happens if my opponent leaves?',
    answer: 'If they are dismissed, you win.'
  }
];
