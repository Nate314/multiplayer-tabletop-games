// Sudoku grid geometry, shared by the client and the server. A grid is 81 numbers, index row * 9 + col, 0 for empty.
export const CELLS = 81;

export const rowOf = (cell: number): number => Math.floor(cell / 9);
export const colOf = (cell: number): number => cell % 9;
export const boxOf = (cell: number): number => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3);

// The 20 other cells sharing a row, column or box
export function peers(cell: number): number[] {
  const result: number[] = [];
  for (let other = 0; other < CELLS; other++) {
    if (other !== cell && (rowOf(other) === rowOf(cell) || colOf(other) === colOf(cell) || boxOf(other) === boxOf(cell))) result.push(other);
  }
  return result;
}

export const cellName = (cell: number): string => `row ${rowOf(cell) + 1}, column ${colOf(cell) + 1}`;
