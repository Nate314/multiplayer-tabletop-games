import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Score points by laying triangle tiles whose corner numbers match the board, and play out your hand to win the round. The first round to end with someone at the target score (400 points unless the host chose another) ends the game, and the highest total wins.'
  },
  {
    question: 'How many tiles do I get, and who goes first?',
    answer: 'There are 56 tiles, numbered 0 to 5 at the corners. Everyone is dealt 9 tiles with two players, 7 with three or four, and 6 with five or six; the rest form the pool. Every round, the holder of the highest triple (5-5-5 first) opens with it and scores its sum plus 10, or 40 for 0-0-0. Without a triple, the tile with the highest sum opens and scores its sum.'
  },
  {
    question: 'Which tiles can I play?',
    answer: 'A tile that shares an edge with a tile on the board and matches every corner it touches, including a corner that only touches another tile at a point. Playable tiles are raised and outlined; the rest are dimmed.'
  },
  {
    question: 'What if a space takes my tile more than one way?',
    answer: 'The tile is shown on the space, and you choose the way it faces before you play it. A space that takes the tile only one way plays it at once.'
  },
  {
    question: 'How does a tile score?',
    answer: 'A tile scores the sum of its numbers. With the Hexagon bonus, completing six tiles around a point scores 50 more, or 100 for two hexagons at once. With the Bridge bonus, a tile that matches an edge on one side and touches a tile only at the point across from it scores 40 more. Both bonuses are on unless the host turned them off.'
  },
  {
    question: 'What if nothing fits?',
    answer: 'Draw a tile from the pool, losing 5 points. You may draw up to 3 tiles a turn and play a drawn tile that fits at once. If none fits after 3 draws, you pass and lose 10 more. With the pool empty, passing costs 10.'
  },
  {
    question: 'When does a round end, and how is it scored?',
    answer: 'When a player plays their last tile, they score 25 plus the sum left in every other hand. When the pool is empty and nobody can play, the round is blocked: the player with the lowest sum left scores the difference to each other hand, and a tie for lowest scores nothing. A scoring screen shows the round, and the next round is dealt once every connected player continues.'
  },
  {
    question: 'Can I see other players\' tiles or the pool?',
    answer: 'No. You see only your own hand, how many tiles each other player holds and how many are in the pool.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Everyone is asked to undo the last move. It is undone only if every player still in the game approves. After an undo the pool is shuffled again, so an undone draw cannot show you which tile is next.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If they disconnect, the game waits for them on their turn, the scoring screen does not wait for them, and the others may vote to dismiss them. A dismissed player\'s tiles go back into the pool and their turns are skipped. If only one player is left, they win.'
  },
  {
    question: 'Can the rules be changed?',
    answer: 'Before play starts the host can turn off the Hexagon bonus or the Bridge bonus and choose a target score of 200, 400 (the standard) or 600. Everyone has to agree before play starts, and the rules cannot change afterwards.'
  }
];
