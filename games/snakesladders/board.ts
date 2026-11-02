// The fixed board, pure so the rules, the client and the e2e tests share it
export const START = 1;
export const FINISH = 100;
export const SIZE = 10;

// Foot to top
export const LADDERS: Readonly<Record<number, number>> = {
  3: 22, 8: 30, 21: 42, 28: 76, 36: 57, 50: 69, 71: 92, 80: 99
};
// Head to tail
export const SNAKES: Readonly<Record<number, number>> = {
  27: 5, 43: 17, 55: 34, 66: 45, 74: 53, 89: 68, 96: 77, 98: 61
};

export function jumpFrom(square: number): { to: number; via: 'ladder' | 'snake' } | null {
  if (square in LADDERS) return { to: LADDERS[square], via: 'ladder' };
  if (square in SNAKES) return { to: SNAKES[square], via: 'snake' };
  return null;
}

// Row 0 is the top and col 0 the left; square 1 is bottom left and each row reverses the one below
export function cellOf(square: number): { row: number; col: number } {
  const index = square - 1;
  const rowFromBottom = Math.floor(index / SIZE);
  const offset = index % SIZE;
  return { row: SIZE - 1 - rowFromBottom, col: rowFromBottom % 2 === 0 ? offset : SIZE - 1 - offset };
}
