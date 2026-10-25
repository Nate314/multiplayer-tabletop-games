// Remembers that this player just dropped a piece, so useMoveAnimation skips sliding it in from where it started
export const DROP_SNAP_MS = 1000;

let droppedAt: number | null = null;

export function markDropped(now = performance.now()): void {
  droppedAt = now;
}

// True once for a mark made within DROP_SNAP_MS
export function takeDrop(now = performance.now()): boolean {
  const recent = droppedAt !== null && now - droppedAt <= DROP_SNAP_MS;
  droppedAt = null;
  return recent;
}
