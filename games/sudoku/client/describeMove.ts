import { cellName } from '../grid.ts';
import type { PublicGameState } from '../types.ts';

// The move that produced this state, for the history dialog; another racer's move during the race has no cell
export function describeMove({ lastMove, playerNames }: Pick<PublicGameState, 'lastMove' | 'playerNames'>): string {
  if (!lastMove) return '';
  const name = playerNames[lastMove.playerNumber];
  if (lastMove.finished) return `${name} finished first!`;
  const { cell, digit } = lastMove;
  if (lastMove.type === 'enter') return cell === undefined ? `${name} wrote a digit` : `${name} wrote ${digit} in ${cellName(cell)}`;
  if (lastMove.type === 'erase') return cell === undefined ? `${name} erased a digit` : `${name} erased ${cellName(cell)}`;
  return cell === undefined ? `${name} took back a move` : `${name} took back their move in ${cellName(cell)}`;
}
