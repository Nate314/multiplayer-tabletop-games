import type { FaqItem } from '../../../src/clientGames.ts';

export const QUESTIONS: FaqItem[] = [
  {
    question: 'What is the goal?',
    answer: 'Play out your hand to win the round. You then score the pips on the tiles left in everyone else\'s hands, plus the pips in the boneyard, and the first player to reach 100 points (61 with three or four players) wins the game.'
  },
  {
    question: 'Which set is used?',
    answer: 'Double-six (28 tiles) or double-nine (55 tiles). The host chooses it in the house rules before the first move, and the tiles are dealt again. The first move locks it with the other house rules.'
  },
  {
    question: 'How many tiles do I get, and who goes first?',
    answer: 'With double-six everyone is dealt 7 tiles (6 with four players); with double-nine, 9. The rest form the boneyard. In the first round the holder of the highest double leads with it, or with the heaviest tile if nobody has a double. In later rounds the winner of the last round leads with any tile. With Trains every round is led with the highest double held, and the previous winner does not lead.'
  },
  {
    question: 'Which tiles can I play?',
    answer: 'A tile with a number that matches an open end of any arm of the line. It is flipped to fit, so the matching half touches the line. Playable tiles are raised and outlined; the rest are dimmed. The table lists the open ends, and on your turn the ends you may play on are highlighted on the board.'
  },
  {
    question: 'What do the branching settings do?',
    answer: 'The host picks one in the house rules under Doubles open branches. None plays a single line with two ends, where a double is like any other tile. Starting double only lets the first double of the round open four ends (or three, if the round was not led by a double); later doubles are like any other tile. Every double, the default, makes every double open branches: the starting double opens four ends, and a double played on an end opens three, each taking the double\'s number.'
  },
  {
    question: 'What is Chickenfoot?',
    answer: 'A house rule that makes every double be finished before anyone plays elsewhere: each end it opened must get a tile first. With Every double, a double played on an end opens three ends, the chicken foot, so the next three tiles go on it. Only those ends can be played on until the double is finished. If the boneyard is empty and nobody can finish a double, the round is blocked.'
  },
  {
    question: 'How do trains work?',
    answer: 'With the Trains house rule, every round is led with the highest double held, which becomes the hub. Each player has a train starting from it, and there is a shared Mexican train. You may play on your own train, the Mexican train, any open train, or the train of a player who was dismissed. If nobody holds a double at the start, players draw one tile at a time in seat order until someone draws one, and that player leads with it.'
  },
  {
    question: 'When is my train open?',
    answer: 'When you cannot play, you draw one tile. If it fits you may play it; if not, or if the boneyard is empty, you pass and your train opens, so anyone may play on it. It closes again when you play on your own train.'
  },
  {
    question: 'What if a tile fits more than one end?',
    answer: 'After you click it, the tile is selected and the ends it fits are marked on the board: click one of them, or one of the buttons that ask which end. Click Cancel, or the tile again, to put it back. A tile that fits only one end is played at once.'
  },
  {
    question: 'What if nothing fits?',
    answer: 'Click Draw, or the boneyard, to take a tile. You may draw only when no tile in your hand fits, and you keep drawing, one tile per click, until one fits or the boneyard is empty. When nothing fits and the boneyard is empty, click Pass. With Trains you draw only one tile a turn: if it does not fit, click Pass, and your train opens.'
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
    answer: 'Click Undo to ask everyone to undo the last move. It is undone only if every player still in the game approves. After an undo the boneyard is shuffled again, so an undone draw cannot show you which tile is next. Continue is not a move, so an undo goes back past it too.'
  },
  {
    question: 'What happens if someone leaves?',
    answer: 'If they disconnect, the game waits for them on their turn, the scoring screen does not wait for them, and the others may vote to dismiss them. A dismissed player\'s tiles go back into the boneyard and their turns are skipped. If only one player is left, they win.'
  }
];
