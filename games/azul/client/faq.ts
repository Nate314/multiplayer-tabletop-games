import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'How do I take tiles?',
    answer: 'On your turn, click a tile in a factory or in the center. You pick up every tile of that color from that one place. From a factory, the tiles you leave behind move to the center. Click the tiles again to put them back.'
  },
  {
    question: 'Where can I put them?',
    answer: 'On one of your five pattern lines, the stepped rows on the left of your board. The lines you can use are outlined. A line holds one color only, and you cannot use a line if that row of your wall already has that color.'
  },
  {
    question: 'What if I take more tiles than the line holds?',
    answer: 'The extra tiles drop to your floor line and cost points at the end of the round. You can also click the floor line to send all of them there.'
  },
  {
    question: 'What is the tile marked 1?',
    answer: 'The first-player marker. Whoever first takes tiles from the center in a round gets it on their floor line, where it costs a point like any other tile, and starts the next round.'
  },
  {
    question: 'When do tiles move to my wall?',
    answer: 'When the factories and the center are empty, the round ends. Each full pattern line moves one tile onto the wall in the same row. Lines that are not full keep their tiles for the next round.'
  },
  {
    question: 'How is a wall tile scored?',
    answer: 'A tile touching no other tile scores 1. Otherwise it scores the length of the row of connected tiles it joins, plus the length of the column it joins. A tile that joins a row of 3 and a column of 2 scores 5.'
  },
  {
    question: 'What does the floor line cost?',
    answer: 'Its seven spaces cost 1, 1, 2, 2, 2, 3 and 3 points. Tiles past the seventh space cost nothing. Your score never drops below zero.'
  },
  {
    question: 'What is the scoring screen after each round?',
    answer: 'It lists every tile placed, what it scored and why, and the floor line penalties. The next round is dealt once every player has pressed Continue.'
  },
  {
    question: 'When does the game end, and who wins?',
    answer: 'The game ends after the round in which someone completes a horizontal row of their wall. Then each complete row adds 2 points, each complete column 7, and each color placed all five times 10. The highest score wins. A tie goes to the player with more complete rows.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last turn. It is undone only if every player still in the game approves.'
  },
  {
    question: 'In what order do we play?',
    answer: 'Boards are shown in turn order, starting with yours on the left. Play passes to the next board on the right, then back to you.'
  },
  {
    question: 'Can I tell the colors apart without seeing color?',
    answer: 'Yes. Turn on Color-blind symbols in Settings and each tile shows the shape of its color in place of its mark: red circle, blue square, yellow star, black diamond, cyan pentagon. Tiles in factories, the center, pattern lines, the wall and the floor show it; the first player marker does not.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'Their board stays and is still scored, but their turns are skipped, they cannot win, and a full row on their board does not end the game. The last player left wins. Nobody can join after the first move.'
  }
];
