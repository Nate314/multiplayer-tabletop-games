import type { Board } from './types.ts';

// '.' empty, 'X' black, 'O' white, top row first; rows or characters left out are empty points
export function boardOf(rows: string[], size = 5): Board {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const ch = rows[row]?.[col];
      return ch === 'X' ? 'black' : ch === 'O' ? 'white' : null;
    })
  );
}
