// Farkle scoring, copied from the "Standard Scoring" section of https://en.wikipedia.org/wiki/Farkle.
// Each scoring combination must be made in a single throw.

export const SINGLE_ONE = 100;
export const SINGLE_FIVE = 50;
const THREE_OF_A_KIND: Record<number, number> = { 1: 1000, 2: 200, 3: 300, 4: 400, 5: 500, 6: 600 };
const FOUR_OF_A_KIND = 1000;
const FIVE_OF_A_KIND = 2000;
const SIX_OF_A_KIND = 3000;
const THREE_PAIR = 1500;
const RUN = 2500;

export type Combination = { name: string; dice: number[]; points: number };

// One example of every row of the table, for the rules screen and the tests
export const SCORING_TABLE: Combination[] = [
  { name: 'Each one', dice: [1], points: SINGLE_ONE },
  { name: 'Each five', dice: [5], points: SINGLE_FIVE },
  ...[1, 2, 3, 4, 5, 6].map(face => ({ name: `Three ${face}s`, dice: [face, face, face], points: THREE_OF_A_KIND[face] })),
  { name: 'Four of a kind', dice: [2, 2, 2, 2], points: FOUR_OF_A_KIND },
  { name: 'Five of a kind', dice: [2, 2, 2, 2, 2], points: FIVE_OF_A_KIND },
  { name: 'Six of a kind', dice: [2, 2, 2, 2, 2, 2], points: SIX_OF_A_KIND },
  { name: 'Three pair', dice: [1, 1, 3, 3, 4, 4], points: THREE_PAIR },
  { name: 'Run', dice: [1, 2, 3, 4, 5, 6], points: RUN }
];

const SINGLES: Record<number, number> = { 1: SINGLE_ONE, 5: SINGLE_FIVE };

// What `count` dice of one face are worth, or null if they do not all score. Three or more may also be split
// into three of a kind and singles, whichever is worth more (three ones and a one beat four of a kind).
function faceScore(face: number, count: number): number | null {
  const single = SINGLES[face] ?? 0;
  if (count < 3) return single > 0 || count === 0 ? single * count : null;
  const kind = [0, 0, 0, THREE_OF_A_KIND[face], FOUR_OF_A_KIND, FIVE_OF_A_KIND, SIX_OF_A_KIND][count];
  return Math.max(kind, THREE_OF_A_KIND[face] + single * (count - 3));
}

// The points the dice are worth together, or null when the selection is empty or any die does not score
export function score(dice: number[]): number | null {
  if (dice.length === 0) return null;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const die of dice) counts[die]++;
  const faces = counts.slice(1);
  if (dice.length === 6 && faces.every(count => count === 1)) return RUN;
  if (dice.length === 6 && faces.filter(count => count === 2).length === 3) return THREE_PAIR;

  let total = 0;
  for (let face = 1; face <= 6; face++) {
    const part = faceScore(face, counts[face]);
    if (part === null) return null;
    total += part;
  }
  return total;
}

// Whether some part of a roll scores; a roll where none does is a farkle
export function canScore(dice: number[]): boolean {
  for (let mask = 1; mask < 1 << dice.length; mask++) {
    if (score(dice.filter((_, index) => mask & (1 << index))) !== null) return true;
  }
  return false;
}
