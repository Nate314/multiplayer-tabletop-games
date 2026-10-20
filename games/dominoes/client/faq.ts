import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Play out your hand to win the round. You then score the pips on the tiles left in everyone else\'s hands, plus the pips in the boneyard, and the first player to reach 100 points (61 with three or four players) wins the game.'
  },
  {
    question: 'Which set is used?',
    answer: 'Double-six (28 tiles) or double-nine (55 tiles). Any seated player can choose it in the lobby, before the first move, and the tiles are dealt again. The first move locks the choice.'
  },
  {
    question: 'How many tiles do I get, and who goes first?',
    answer: 'With double-six everyone is dealt 7 tiles (6 with four players); with double-nine, 9. The rest form the boneyard. In the first round the holder of the highest double leads with it, or with the heaviest tile if nobody has a double. In later rounds the winner of the last round leads with any tile.'
  },
  {
    question: 'Which tiles can I play?',
    answer: 'A tile with a number that matches one of the two open ends of the line. It is flipped to fit, so the matching half touches the line. Playable tiles are raised and outlined; the rest are dimmed. The line is a single line with two ends (there are no branches).'
  },
  {
    question: 'What if a tile fits both ends?',
    answer: 'After you click it, buttons ask which end to play it on. Click Cancel to put the tile back.'
  },
  {
    question: 'What if nothing fits?',
    answer: 'Click Draw, or the boneyard, to take a tile. You may draw only when no tile in your hand fits, and you keep drawing, one tile per click, until one fits or the boneyard is empty. When nothing fits and the boneyard is empty, click Pass.'
  },
  {
    question: 'When does a round end?',
    answer: 'When a player plays their last tile, or when the game is blocked: nobody can play and the boneyard is empty. The round ends the moment it is blocked.'
  },
  {
    question: 'How is a round scored?',
    answer: 'The player who goes out scores all the pips left in the other hands and in the boneyard. In a blocked round the player with the fewest pips left wins and scores the pips in the other hands; if two players tie for the fewest, nobody scores. A scoring screen shows the round, and the next round is dealt once every connected player clicks Continue.'
  },
  {
    question: 'Can I see other players\' tiles or the boneyard?',
    answer: 'No. You see only your own hand, how many tiles each other player holds and how many are in the boneyard. Which tiles are left in the boneyard is hidden from everyone.'
  },
  {
    question: 'Can I take back a move?',
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every player still in the game approves. After an undo the boneyard is shuffled again, so an undone draw cannot show you which tile is next. Choosing the set and Continue are not moves, so an undo goes back past them too.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If they disconnect, the game waits for them on their turn, the scoring screen does not wait for them, and the others may vote to dismiss them. A dismissed player\'s tiles go back into the boneyard and their turns are skipped. If only one player is left, they win.'
  }
];
