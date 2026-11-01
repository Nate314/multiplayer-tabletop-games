import type { Color, Feedback } from './types.ts';

// Exact: same color in the same place. ColorOnly: right color elsewhere, each code peg counted once
export function feedback(code: Color[], guess: Color[]): Feedback {
  const exact = code.filter((color, index) => guess[index] === color).length;
  const shared = [...new Set(code)].reduce((sum, color) => sum + Math.min(count(code, color), count(guess, color)), 0);
  return { exact, colorOnly: shared - exact };
}

function count(pegs: Color[], color: Color): number {
  return pegs.filter(peg => peg === color).length;
}
