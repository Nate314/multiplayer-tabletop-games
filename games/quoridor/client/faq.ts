import type { FaqItem } from '../../../src/clientGames.ts';

export const FAQS: FaqItem[] = [
  {
    question: 'How do I join a game?',
    answer: 'Enter your name and a Game ID. Anyone who enters the same Game ID joins the same game, up to four ' +
      'players. The game needs at least two players, and nobody can join after the first move.'
  },
  {
    question: 'How do I move?',
    answer: 'On your turn, with Move selected, click one of the highlighted squares. Move is selected at the ' +
      'start of every turn. You can move one square up, down, left or right, or jump straight over a pawn ' +
      'next to you if the square behind it is free. If a wall, another pawn or the board edge is behind that ' +
      'pawn, you can step diagonally to either side of it instead, as long as no wall or pawn is in the way. ' +
      'You can never jump over a wall or over two pawns. You can also drag your pawn onto a highlighted square; ' +
      'drop it anywhere else to put it back.'
  },
  {
    question: 'How do I place a wall?',
    answer: 'On your turn, choose Horizontal Wall or Vertical Wall, then hover over the board to preview the wall ' +
      'and click to place it. A horizontal wall runs under the square you click and the one to its right. A ' +
      'vertical wall runs along the right of the square you click and the one below it. Placing a wall uses ' +
      'your turn. Or use the tray of walls below the action buttons: tap the wall to pick it up, and a dot on the ' +
      'bottom right corner of a square marks each place it can go, the middle of the wall it would make. Tap it again, click Rotate or press R to turn it, then click a dotted square, ' +
      'or drag the wall from the tray onto the board.'
  },
  {
    question: 'Where can walls go?',
    answer: 'A wall cannot overlap or cross another wall, and it cannot completely cut any player off from their ' +
      'goal. Walls stay on the board for the rest of the game.'
  },
  {
    question: 'How many walls do I get?',
    answer: 'The twenty walls are shared out equally: ten each with two players, six each with three (two ' +
      'stay unused) and five each with four. The count is shown under "Walls left".'
  },
  {
    question: 'How do I win?',
    answer: 'Be the first to reach the side of the board opposite where you started. That side of the board frame ' +
      'is in your pawn\'s color, and every player\'s goal is listed under "Goals".'
  },
  {
    question: 'What does Undo do?',
    answer: 'Undo asks everyone to take back the last turn; it happens only if every player still in the game ' +
      'approves.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'Their pawn leaves the board, their walls stay, and their turns are skipped.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each pawn color also shows its shape: blue square, red circle, green triangle, purple cross. Pawns and the Goals list show it.'
  }
];
