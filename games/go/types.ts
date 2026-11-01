export type Stone = 'black' | 'white';
export type Point = { row: number; col: number }; // row 0 is the top edge, col 0 is column A
export type Board = (Stone | null)[][];
export type BoardSize = 9 | 13 | 19;
