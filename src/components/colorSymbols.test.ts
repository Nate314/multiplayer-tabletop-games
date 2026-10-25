import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_SYMBOLS } from './colorSymbols.ts';
import { SHAPE_PATHS } from '../../shared/svg/symbols.ts';

test('every color has its own shape and every shape has a path', () => {
  const shapes = Object.values(COLOR_SYMBOLS);
  assert.equal(new Set(shapes).size, shapes.length);
  assert.deepEqual(Object.keys(COLOR_SYMBOLS).sort(), ['black', 'blue', 'cyan', 'green', 'orange', 'pink', 'purple', 'red', 'white', 'yellow']);
  assert.equal(COLOR_SYMBOLS.red, 'circle');
  assert.equal(COLOR_SYMBOLS.blue, 'square');
  assert.equal(COLOR_SYMBOLS.green, 'triangle');
  assert.equal(COLOR_SYMBOLS.yellow, 'star');
  for (const shape of shapes) assert.ok(SHAPE_PATHS[shape].length > 0, shape);
});
