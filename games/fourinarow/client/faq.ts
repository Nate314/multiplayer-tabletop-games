import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Four in a Row is ' +
      'for exactly two players, and nobody can join after the first move. The first player plays Red and moves ' +
      'first; the second plays Yellow.'
  },
  {
    question: 'How do discs fall?',
    answer: 'A disc dropped in a column falls to the lowest empty cell. A full column cannot be chosen.'
  },
  {
    question: 'How do I win?',
    answer: 'Be the first to line up four of your discs in a row: across, up and down, or diagonally. The winning ' +
      'four are highlighted.'
  },
  {
    question: 'Can the game be drawn?',
    answer: 'Yes. If the board fills up with no four in a row, the game is a draw. You can also agree to a draw: ' +
      'either player can offer one at any time. The offer lapses if the opponent declines or makes a move ' +
      'instead.'
  },
  {
    question: 'When can I resign?',
    answer: 'You can resign at any time, on either player\'s turn, and your opponent wins.'
  },
  {
    question: 'What does Undo do?',
    answer: 'It takes back the last disc, but only if your opponent approves.'
  },
  {
    question: 'What is highlighted on the board?',
    answer: 'The last disc dropped is outlined in yellow, and the winning four glow green. The board is dimmed ' +
      'when it is not your turn.'
  },
  {
    question: 'What happens if my opponent leaves?',
    answer: 'If they are dismissed, you win.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each color also shows its shape: Red circle, Yellow star. Discs and the player list show it.'
  }
];
