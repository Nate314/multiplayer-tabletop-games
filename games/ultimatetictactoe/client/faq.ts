import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game. Ultimate ' +
      'Tic-Tac-Toe is for exactly two players, and nobody can join after the first move.'
  },
  {
    question: 'How do I place a mark?',
    answer: 'On your turn, click or tap an empty cell in a highlighted board. A cell that already holds a mark cannot be chosen.'
  },
  {
    question: 'Where can I play?',
    answer: 'The cell your opponent just played sends you to the matching board: a mark in the top right cell of ' +
      'any board sends you to the top right board. If that board is already won or full, you may play in any open ' +
      'board instead. The first mark of the game may go anywhere. The boards you may play in are highlighted.'
  },
  {
    question: 'Who goes first?',
    answer: 'X always moves first. The first player to join plays X in the first game, and the marks swap on each ' +
      'rematch, so the other player moves first in the next game.'
  },
  {
    question: 'How do I claim a board?',
    answer: 'Get three of your marks in a row in a small board, across, down or diagonally. The board shows your big ' +
      'mark and takes no more marks.'
  },
  {
    question: 'What happens to a full board?',
    answer: 'A small board that fills up with no three in a row is drawn: it is greyed out, takes no more marks and ' +
      'counts for nobody, so no line of boards through it can win.'
  },
  {
    question: 'How do I win?',
    answer: 'Be the first to claim three boards in a row: across, down or diagonally. The winning three boards glow.'
  },
  {
    question: 'Can the game be drawn?',
    answer: 'Yes. If every board is claimed or full with no line of three claimed boards, the game is a draw. You can ' +
      'also agree to a draw: click Offer draw at any time; your opponent sees Accept draw and Decline. The offer ' +
      'lapses if they decline or make a move instead.'
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
    answer: 'The boards you may play in are outlined, the last mark is outlined in yellow, and the winning three ' +
      'boards glow green. The boards are dimmed, and their cells are off, when it is not your turn.'
  },
  {
    question: 'What happens if my opponent leaves?',
    answer: 'If they are dismissed, you win.'
  }
];
