import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Tic-Tac-Toe is ' +
      'for exactly two players, and nobody can join after the first move.'
  },
  {
    question: 'How do I place a mark?',
    answer: 'On your turn, click or tap an empty cell. A cell that already holds a mark cannot be chosen.'
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
    answer: 'Undo asks your opponent to take back the last mark; it happens only if they approve.'
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
