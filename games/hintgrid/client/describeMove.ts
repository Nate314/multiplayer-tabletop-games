import { TEAM_NAMES } from '../teams.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog
export function describeMove({ lastMove, playerNames, words }: Pick<PublicGameState, 'lastMove' | 'playerNames' | 'words'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  if (lastMove.type === 'clue') return `${name} gave the clue ${lastMove.clue.word} ${lastMove.clue.count}`;
  if (lastMove.type === 'endGuessing') return `${name} ended guessing`;
  const { kind } = lastMove;
  const what = kind === 'trap' ? 'the trap' : kind === 'bystander' ? 'a bystander' : TEAM_NAMES[kind];
  return `${name} turned over ${words[lastMove.index]}: ${what}`;
}
