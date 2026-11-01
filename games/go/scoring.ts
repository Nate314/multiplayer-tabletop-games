import { neighbors } from './board.ts';
import type { Board, Point, Stone } from './types.ts';

export const KOMI = 7.5;

export type AreaScore = {
  black: { stones: number; territory: number; total: number };
  white: { stones: number; territory: number; komi: number; total: number };
};

// Area scoring: stones on the board plus empty points bordered by only one color. Dead stones are lifted first.
export function areaScore(board: Board, dead: Point[], komi = KOMI): AreaScore {
  const size = board.length;
  const grid = board.map((row) => [...row]);
  for (const { row, col } of dead) grid[row][col] = null;

  const stones = { black: 0, white: 0 };
  const territory = { black: 0, white: 0 };
  const seen = new Set<string>();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const stone = grid[row][col];
      if (stone) {
        stones[stone]++;
        continue;
      }
      if (seen.has(`${row},${col}`)) continue;
      // Flood fill the empty region, noting which colors border it
      const borders = new Set<Stone>();
      let area = 0;
      const stack = [{ row, col }];
      seen.add(`${row},${col}`);
      while (stack.length > 0) {
        const current = stack.pop()!;
        area++;
        for (const next of neighbors(current, size)) {
          const around = grid[next.row][next.col];
          if (around) borders.add(around);
          else if (!seen.has(`${next.row},${next.col}`)) {
            seen.add(`${next.row},${next.col}`);
            stack.push(next);
          }
        }
      }
      if (borders.size === 1) territory[[...borders][0]] += area;
    }
  }
  return {
    black: { stones: stones.black, territory: territory.black, total: stones.black + territory.black },
    white: {
      stones: stones.white,
      territory: territory.white,
      komi,
      total: stones.white + territory.white + komi
    }
  };
}

export function scoreLine(score: AreaScore): string {
  return `Black ${score.black.total}, White ${score.white.total}`;
}
