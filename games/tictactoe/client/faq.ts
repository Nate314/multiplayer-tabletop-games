import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Tic-Tac-Toe is ' +
      'for exactly two players, and nobody can join after the first move.'
  },
  {
    question: 'Who goes first?',
    answer: 'X always moves first. The first player to join plays X in the first game, and the marks swap on each ' +
      'rematch, so the other player moves first in the next game.'
  },
  {
    question: 'How do I win?',
    answer: 'Be the first to get three of your marks in a row: across, down or diagonally. The winning three are highlighted.'
  },
  {
    question: 'Can the game be drawn?',
    answer: 'Yes. If the grid fills up with no three in a row, the game is a draw. You can also agree to a draw: ' +
      'either player can offer one at any time. The offer lapses if the opponent declines or makes a move instead.'
  },
  {
    question: 'When can I resign?',
    answer: 'You can resign at any time, on either player\'s turn, and your opponent wins.'
  },
  {
    question: 'What does Undo do?',
    answer: 'It takes back the last mark, but only if your opponent approves.'
  },
  {
    question: 'What is highlighted on the board?',
    answer: 'The last mark is outlined in yellow, and the winning three glow green. The board is dimmed, and its ' +
      'cells are off, when it is not your turn.'
  },
  {
    question: 'What happens if my opponent leaves?',
    answer: 'If they are dismissed, you win.'
  }
];
