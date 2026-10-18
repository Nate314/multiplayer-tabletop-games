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
      'You can never jump over a wall or over two pawns.'
  },
  {
    question: 'How do I place a wall?',
    answer: 'On your turn, choose Horizontal Wall or Vertical Wall, then hover over the board to preview the wall ' +
      'and click to place it. A horizontal wall runs under the square you click and the one to its right. A ' +
      'vertical wall runs along the right of the square you click and the one below it. Placing a wall uses ' +
      'your turn.'
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
    question: 'What do Undo and Show Last Move do?',
    answer: 'Undo asks everyone to take back the last turn; it happens only if every player still in the game ' +
      'approves. Show Last Move highlights the previous move while you hover over it, or click it to keep ' +
      'the highlight on.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'Their pawn and walls stay on the board and their turns are skipped.'
  }
];
