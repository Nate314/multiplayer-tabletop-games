import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seatColor, seatColorName, SEAT_COLORS } from './seatColors.ts';

test('seats 1 to 8 follow the palette order', () => {
  assert.deepEqual(SEAT_COLORS, ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink']);
  assert.equal(seatColor(1), 'red');
  assert.equal(seatColor(8), 'pink');
});

test('seatColorName capitalizes the color', () => {
  assert.equal(seatColorName(1), 'Red');
  assert.equal(seatColorName(4), 'Yellow');
  assert.equal(seatColorName(7), 'Cyan');
});
