import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keySteps, keyboardTarget, nextSelection, throttleDrag } from './pullInput.ts';
import { QUARTER_TURN, anchorWorld, fromTable, startingTower } from '../physics.ts';
import type { Block, Vec3 } from '../types.ts';

const close = (a: Vec3, b: Vec3) => a.every((n, i) => Math.abs(n - b[i]) < 1e-9);

test('drags are sent at most once every 50 ms', () => {
  assert.equal(throttleDrag(1000, 1049), false);
  assert.equal(throttleDrag(1000, 1050), true);
  assert.equal(throttleDrag(-Infinity, 0), true);
});

test('the keyboard target moves 0.5 along the block, outward or back in', () => {
  const [even] = startingTower();
  const end: Vec3 = [3.75, 0, 0];
  const at = anchorWorld(even, end);
  assert.ok(close(keyboardTarget(even, end, 1), [at[0] + 0.5, at[1], at[2]]));
  assert.ok(close(keyboardTarget(even, end, -1), [at[0] - 0.5, at[1], at[2]]));
  // From the other end, outward is the other way
  const other: Vec3 = [-3.75, 0, 0];
  const otherAt = anchorWorld(even, other);
  assert.ok(close(keyboardTarget(even, other, 1), [otherAt[0] - 0.5, otherAt[1], otherAt[2]]));
  // An odd level runs along Z: a quarter turn takes local +X to world -Z
  const odd: Block = { id: 3, level: 1, pose: { p: [0, 2.25, 0], q: QUARTER_TURN } };
  const oddAt = anchorWorld(odd, end);
  assert.ok(close(keyboardTarget(odd, end, 1), [oddAt[0], oddAt[1], oddAt[2] - 0.5]));
  // Several steps reach further, so the spring pulls harder
  assert.ok(close(keyboardTarget(even, end, 3), [at[0] + 1.5, at[1], at[2]]));
});

test('repeated presses add up to the full reach, and a press the other way starts over', () => {
  assert.equal(keySteps(0, 1), 1);
  assert.equal(keySteps(1, 1), 2);
  assert.equal(keySteps(6, 1), 6);
  assert.equal(keySteps(4, -1), -1);
  assert.equal(keySteps(-2, -1), -3);
  assert.equal(keySteps(-6, -1), -6);
});

test('arrow keys move the selection only over blocks that may be pulled', () => {
  const blocks = startingTower();
  // The top level 17 is full, so blocks 0 to 50 may be pulled; block 48 of level 16 is already out
  const tower = blocks.filter(b => b.id !== 48);
  assert.equal(nextSelection(tower, null, 'ArrowUp'), 49);
  assert.equal(nextSelection(tower, 49, 'ArrowRight'), 50);
  assert.equal(nextSelection(tower, 50, 'ArrowRight'), 50);
  assert.equal(nextSelection(tower, 49, 'ArrowLeft'), 49);
  assert.equal(nextSelection(tower, 49, 'ArrowUp'), 49);
  assert.equal(nextSelection(tower, 50, 'ArrowDown'), 47);
  assert.equal(nextSelection(tower, 45, 'ArrowUp'), 49);
  assert.equal(nextSelection(tower, 1, 'ArrowDown'), 1);
  assert.equal(nextSelection(tower, 4, 'Enter'), 4);
  // A top level of two blocks also locks the level under it, so a selection there starts over at the top legal level
  const short = blocks.filter(b => b.id !== 53);
  assert.equal(nextSelection(short, 47, 'ArrowUp'), 47);
  assert.equal(nextSelection(short, 50, 'ArrowLeft'), 45);
  assert.equal(nextSelection(blocks.slice(0, 3), null, 'ArrowUp'), null);
});

test('selection follows the turned tower', () => {
  const tower = startingTower().filter(b => b.id !== 48);
  const turned = tower.map(b => ({ ...b, pose: fromTable(b.pose, QUARTER_TURN) }));
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    for (const selected of [null, 45, 47, 49, 50]) {
      assert.equal(nextSelection(turned, selected, key, QUARTER_TURN), nextSelection(tower, selected, key), `${key} from ${selected}`);
    }
  }
});
