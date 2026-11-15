// The 56 tiles: every multiset of three numbers 0 to 5, once each, corners read clockwise in non-descending
// order (a <= b <= c). So 0-1-2 is in the set and its mirror 0-2-1 is not; tiles rotate but never flip.
export const TILES: readonly [number, number, number][] = (() => {
  const tiles: [number, number, number][] = [];
  for (let a = 0; a <= 5; a++) for (let b = a; b <= 5; b++) for (let c = b; c <= 5; c++) tiles.push([a, b, c]);
  return tiles;
})();

export const tileSum = (tile: number) => TILES[tile][0] + TILES[tile][1] + TILES[tile][2];
export const isTriple = (tile: number) => TILES[tile][0] === TILES[tile][2];
