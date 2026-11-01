import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { seeded } from '../testStates.ts';
import { boxOf, colOf, rowOf } from './grid.ts';
import { countSolutions, fullGrid, generatePuzzle, GIVENS, solvesWithSingles } from './generator.ts';
import type { Difficulty } from './options.ts';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const SEEDS = [1, 2, 3, 4, 5];
const countGivens = (givens: number[]): number => givens.filter(Boolean).length;

test('fullGrid is a valid solved grid', () => {
  const grid = fullGrid(seeded(1));
  for (const unitOf of [rowOf, colOf, boxOf]) {
    for (let unit = 0; unit < 9; unit++) {
      const digits = grid.filter((_, cell) => unitOf(cell) === unit).sort();
      assert.deepEqual(digits, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  }
});

test('the same seed gives the same puzzle', () => {
  assert.deepEqual(generatePuzzle('medium', seeded(4)), generatePuzzle('medium', seeded(4)));
  assert.notDeepEqual(generatePuzzle('medium', seeded(4)), generatePuzzle('medium', seeded(5)));
});

test('every puzzle has exactly one solution, which matches its solution grid', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const seed of SEEDS) {
      const { givens, solution } = generatePuzzle(difficulty, seeded(seed));
      assert.equal(countSolutions(givens, 2), 1, `${difficulty} ${seed}`);
      givens.forEach((digit, cell) => { if (digit) assert.equal(digit, solution[cell]); });
    }
  }
});

test('givens are symmetric', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const seed of SEEDS) {
      const { givens } = generatePuzzle(difficulty, seeded(seed));
      for (let i = 0; i < 81; i++) assert.equal(givens[i] === 0, givens[80 - i] === 0);
    }
  }
});

test('Easy has 36 or 37 givens and is solved by singles', () => {
  for (const seed of SEEDS) {
    const { givens } = generatePuzzle('easy', seeded(seed));
    assert.ok([GIVENS.easy, GIVENS.easy + 1].includes(countGivens(givens)));
    assert.equal(solvesWithSingles(givens), true);
  }
});

test('Medium has 30 or 31 givens', () => {
  for (const seed of SEEDS) {
    assert.ok([GIVENS.medium, GIVENS.medium + 1].includes(countGivens(generatePuzzle('medium', seeded(seed)).givens)));
  }
});

test('Hard has fewer givens than Medium and needs more than singles', () => {
  for (const seed of SEEDS) {
    const { givens } = generatePuzzle('hard', seeded(seed));
    assert.ok(countGivens(givens) < GIVENS.medium);
    assert.equal(solvesWithSingles(givens), false);
  }
});

test('countSolutions counts more than one', () => {
  assert.equal(countSolutions(Array(81).fill(0), 2), 2);
});

test('a Hard puzzle is generated within 2 seconds', () => {
  const start = performance.now();
  generatePuzzle('hard', seeded(1));
  assert.ok(performance.now() - start < 2000);
});

test('no client file imports generator.ts', () => {
  const dir = new URL('./client/', import.meta.url);
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    if (!/\.tsx?$/.test(file)) continue;
    assert.doesNotMatch(readFileSync(new URL(file, dir), 'utf8'), /generator(\.ts)?'/, file);
  }
});
