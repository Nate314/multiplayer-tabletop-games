import { neighbors } from './board.ts';
import type { Board, Point, Stone } from './types.ts';

export const KOMI = 7.5;

export type AreaScore = {
  black: { stones: number; territory: number; total: number };
  white: { stones: number; territory: number; komi: number; total: number };
};

// Who owns each point once the dead stones are lifted: a live stone's own color, or for an empty point the one
// color that borders its whole empty region (null when both colors or neither do)
export function ownerMap(board: Board, dead: Point[]): Board {
  const size = board.length;
  const grid = board.map((row) => [...row]);
  for (const { row, col } of dead) grid[row][col] = null;
  const owners = grid.map((row) => [...row]);
  const seen = new Set<string>();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (grid[row][col] || seen.has(`${row},${col}`)) continue;
      // Flood fill the empty region, noting which colors border it
      const borders = new Set<Stone>();
      const region: Point[] = [];
      const stack = [{ row, col }];
      seen.add(`${row},${col}`);
      while (stack.length > 0) {
        const current = stack.pop()!;
        region.push(current);
        for (const next of neighbors(current, size)) {
          const around = grid[next.row][next.col];
          if (around) borders.add(around);
          else if (!seen.has(`${next.row},${next.col}`)) {
            seen.add(`${next.row},${next.col}`);
            stack.push(next);
          }
        }
      }
      if (borders.size === 1) for (const p of region) owners[p.row][p.col] = [...borders][0];
    }
  }
  return owners;
}

// Area scoring: stones on the board plus empty points bordered by only one color. Dead stones are lifted first.
export function areaScore(board: Board, dead: Point[], komi = KOMI): AreaScore {
  const isDead = (row: number, col: number) => dead.some((d) => d.row === row && d.col === col);
  const stones = { black: 0, white: 0 };
  const territory = { black: 0, white: 0 };
  ownerMap(board, dead).forEach((cells, row) => cells.forEach((owner, col) => {
    if (!owner) return;
    if (board[row][col] && !isDead(row, col)) stones[owner]++;
    else territory[owner]++;
  }));
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
