import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endPress, movePress, startPress, type Point } from './dragMachine.ts';

const at = (x: number, y: number) => ({ x, y });
const mouse = (point: Point, pointerId = 1) => ({ pointerId, isPrimary: true, button: 0, point });
const lifted = (id: string) => movePress(startPress(null, id, mouse(at(0, 0)))!, 1, at(10, 0));

test('a press starts only for a primary pointer and its main button', () => {
  assert.deepEqual(startPress(null, 'a', mouse(at(0, 0))), { id: 'a', pointerId: 1, start: at(0, 0), lifted: false });
  assert.equal(startPress(null, 'a', { ...mouse(at(0, 0)), button: 2 }), null);
  assert.equal(startPress(null, 'a', { ...mouse(at(0, 0)), isPrimary: false }), null);
});

test('a second press while one is held is ignored', () => {
  const held = startPress(null, 'a', mouse(at(0, 0)))!;
  assert.equal(startPress(held, 'b', mouse(at(9, 9), 2)), held);
});

test('a move under the threshold keeps it a tap', () => {
  const press = movePress(startPress(null, 'a', mouse(at(0, 0)))!, 1, at(3, 4)); // 5px
  assert.equal(press.lifted, false);
  assert.deepEqual(endPress(press, 'b', () => true), { kind: 'tap' });
});

test('a move of the threshold lifts the piece and it stays lifted', () => {
  const lifted = movePress(startPress(null, 'a', mouse(at(0, 0)))!, 1, at(6, 0));
  assert.equal(lifted.lifted, true);
  assert.equal(movePress(lifted, 1, at(0, 0)).lifted, true);
});

test('moves of another pointer change nothing', () => {
  const press = startPress(null, 'a', mouse(at(0, 0)))!;
  assert.equal(movePress(press, 2, at(50, 50)), press);
});

test('a lifted piece released over a legal target drops there', () => {
  assert.deepEqual(endPress(lifted('a'), 'sq', (id, target) => id === 'a' && target === 'sq'), { kind: 'drop', target: 'sq' });
});

test('a lifted piece released over an illegal target, no target, or by pointercancel snaps back', () => {
  assert.deepEqual(endPress(lifted('a'), 'sq', () => false), { kind: 'cancel' });
  assert.deepEqual(endPress(lifted('a'), null, () => true), { kind: 'cancel' });
});
