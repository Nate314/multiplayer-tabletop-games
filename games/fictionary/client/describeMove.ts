import { houseRule } from '../../../shared/houseRules.ts';
import { WORD_COUNT } from '../options.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog; a vote never says for which choice
export function describeMove({ lastMove, playerNames, houseRules }: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'houseRules'>): string {
  if (!lastMove) return '';
  if (lastMove.type === 'write') return `${playerNames[lastMove.playerNumber]} wrote a definition`;
  if (lastMove.type === 'vote') return `${playerNames[lastMove.playerNumber]} voted`;
  if (lastMove.type === 'closeWriting') return lastMove.reason === 'allWritten' ? 'Everyone has written' : 'Writing time is up';
  if (lastMove.type === 'reveal') return `The real definition of ${lastMove.word}: ${lastMove.definition}`;
  return `Word ${lastMove.round} of ${houseRule({ houseRules }, WORD_COUNT)}`;
}
