// Why the player cannot put a meeple on the tile just placed, or undefined when they can; the hint and the tray share it
export function meepleBlocked(meeplesLeft: number, freeSpots: number): string | undefined {
  if (meeplesLeft === 0) return 'All your meeples are on the board';
  if (freeSpots === 0) return 'No free feature on this tile for a meeple';
  return undefined;
}
