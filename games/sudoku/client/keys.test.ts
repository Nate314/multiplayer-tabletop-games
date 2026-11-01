import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyToCommand } from './keys.ts';

test('a digit key enters that digit', () => {
  assert.deepEqual(keyToCommand('5', 0), { kind: 'digit', digit: 5 });
});

test('Backspace, Delete and 0 erase', () => {
  for (const key of ['Backspace', 'Delete', '0']) assert.deepEqual(keyToCommand(key, 40), { kind: 'erase' });
});

test('the arrows move the selection and stop at the edges', () => {
  assert.deepEqual(keyToCommand('ArrowRight', 8), { kind: 'move', to: 8 });
  assert.deepEqual(keyToCommand('ArrowDown', 0), { kind: 'move', to: 9 });
  assert.deepEqual(keyToCommand('ArrowUp', 4), { kind: 'move', to: 4 });
  assert.deepEqual(keyToCommand('ArrowLeft', 10), { kind: 'move', to: 9 });
  assert.deepEqual(keyToCommand('ArrowDown', 80), { kind: 'move', to: 80 });
});

test('an arrow with nothing selected starts at the top left', () => {
  assert.deepEqual(keyToCommand('ArrowRight', null), { kind: 'move', to: 0 });
});

test('n toggles pencil mode', () => {
  assert.deepEqual(keyToCommand('n', 0), { kind: 'pencil' });
});

test('any other key does nothing', () => {
  assert.equal(keyToCommand('x', 0), null);
});
