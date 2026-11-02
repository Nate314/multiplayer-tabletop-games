import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedback } from './feedback.ts';
import type { Color } from './types.ts';

const pegs = (text: string) => text.split(' ') as Color[];

const CASES: [string, string, number, number][] = [
  ['red red green blue', 'red red green blue', 4, 0],
  ['red green blue yellow', 'yellow blue green red', 0, 4],
  ['red red blue blue', 'blue blue red red', 0, 4],
  ['red green green blue', 'green green green green', 2, 0],
  ['red red green green', 'red green red blue', 1, 2],
  ['red green blue yellow', 'red red red red', 1, 0],
  ['red red red green', 'green red red red', 2, 2],
  ['red green blue yellow', 'orange purple orange purple', 0, 0],
  ['red red green green', 'green green green green', 2, 0],
  ['pink cyan red red blue', 'red pink cyan blue red', 0, 5]
];

test('feedback counts exact pegs first and each code peg once', () => {
  for (const [code, guess, exact, colorOnly] of CASES) {
    assert.deepEqual(feedback(pegs(code), pegs(guess)), { exact, colorOnly }, `${code} / ${guess}`);
  }
});
