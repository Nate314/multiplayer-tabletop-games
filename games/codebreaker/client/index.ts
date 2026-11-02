import type { ClientGame } from '../../../src/clientGames.ts';
import GameScreen from './GameScreen';
import HistoryBoard from './HistoryBoard';
import { FinalRound } from './RoundRows';
import { FAQS } from './faq.ts';
import { describeMove } from './describeMove.ts';
import { modeOf } from '../../../shared/puzzleModes.ts';
import { plural } from '../../../shared/text.ts';
import { CODEBREAKER_MODE } from '../options.ts';
import type { PublicGameState } from '../types.ts';
import './codebreaker.scss';

// Classic counts rounds; Solo and Together the guesses on the board; Race the most guesses any board used
function gameLength(gameState: PublicGameState): string {
  const mode = modeOf(gameState, CODEBREAKER_MODE);
  if (mode === 'classic') return plural(gameState.rounds.length, 'round');
  const guesses = mode === 'race' ? Math.max(0, ...Object.values(gameState.guessesUsed).map(Number)) : gameState.board.guesses.length;
  return plural(guesses, 'guess', 'guesses');
}

export const codebreakerClient: ClientGame = {
  id: 'codebreaker',
  Screen: GameScreen,
  faq: FAQS,
  HistoryBoard,
  describeMove,
  gameLength,
  FinalRound
};
