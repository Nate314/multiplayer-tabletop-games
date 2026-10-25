export type DrawnStep<K> = { add: K[]; clear: boolean };

// The cards to highlight after a render. Exactly one more move applies the step; the same move count (a vote, an action,
// a disconnect) keeps what is there; the first state, an undo and a jump of several moves highlight nothing.
export function nextDrawn<K>(current: K[], previousMoveCount: number | null, nextMoveCount: number, step: () => DrawnStep<K>): K[] {
  if (previousMoveCount === null) return [];
  if (nextMoveCount === previousMoveCount) return current;
  if (nextMoveCount !== previousMoveCount + 1) return [];
  const { add, clear } = step();
  return clear ? add : [...current, ...add];
}
