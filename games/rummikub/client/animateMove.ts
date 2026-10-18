import { MOVE_DURATION_MS, slideFrom } from '../../../src/animation/motion.ts';
import type { MoveChange } from '../../../src/animation/useMoveAnimation.ts';
import type { PublicGameState, Seat } from '../types.ts';

export const tileKey = (id: number) => `tile-${id}`;
export const seatKey = (seat: Seat) => `seat-${seat}`;
export const POOL_KEY = 'pool';

// The gap between tiles that follow one another
export const STAGGER_MS = 60;

// Where each tile shown after a move slides from: its own place before the move when it was shown then
// (a tile moved about the table, or a rack tile the viewer played), else the row of the player who played it,
// or the pool for a tile the viewer drew
export type Slide = { id: number; from: 'self' | 'seat' | 'pool' };

export function slidePlan(previous: Pick<PublicGameState, 'table' | 'rack'>, next: Pick<PublicGameState, 'table' | 'rack' | 'lastMove'>): Slide[] {
  const { lastMove } = next;
  if (!lastMove) return [];
  const shown = new Set([...previous.table.flat(), ...previous.rack]);
  return [...next.table.flat(), ...next.rack].map(id => {
    if (shown.has(id)) return { id, from: 'self' };
    return { id, from: lastMove.type === 'draw' ? 'pool' : 'seat' };
  });
}

// Tiles glide to their new places; tiles another player put down come from their row, a drawn tile from the pool
export function animateMove({ previous, next, root, rectOf }: MoveChange<PublicGameState>) {
  const { lastMove } = next;
  if (!lastMove) return;
  let incoming = 0;
  for (const { id, from } of slidePlan(previous, next)) {
    const element = root.querySelector(`[data-anim-key="${tileKey(id)}"]`);
    const fromKey = from === 'self' ? tileKey(id) : from === 'pool' ? POOL_KEY : seatKey(lastMove.playerNumber);
    const rect = rectOf(fromKey);
    if (element && rect) slideFrom(element, rect, MOVE_DURATION_MS, from === 'self' ? 0 : STAGGER_MS * incoming++);
  }
}
