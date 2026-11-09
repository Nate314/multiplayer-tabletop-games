import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames, drawer }: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'drawer'>): string {
  if (!lastMove) return '';
  if (lastMove.type === 'reveal') {
    if (lastMove.reason === 'allGuessed') return `Everyone guessed it: ${lastMove.word}`;
    if (lastMove.reason === 'timeUp') return `Time ran out: the prompt was ${lastMove.word}`;
    return `${drawer === null ? 'The actor' : playerNames[drawer]} left: the prompt was ${lastMove.word}`;
  }
  const name = playerNames[lastMove.playerNumber];
  if (lastMove.type === 'choose') return `${name} chose a prompt`;
  if (lastMove.type === 'autoChoose') return `${name} ran out of time, so a prompt was picked`;
  if (lastMove.type === 'guess') return `${name} guessed the prompt (+${lastMove.points})`;
  return `${name}'s turn to act`;
}
