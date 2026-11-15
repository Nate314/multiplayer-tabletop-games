import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILES, isTriple, tileSum } from './tiles.ts';

const rotationKeys = ([a, b, c]: [number, number, number]) => [`${a}${b}${c}`, `${b}${c}${a}`, `${c}${a}${b}`];
const idOf = (text: string) => TILES.findIndex(t => t.join('') === text);

test('there are 56 tiles: 6 triples, 30 with a pair, 20 with three different numbers', () => {
  assert.equal(TILES.length, 56);
  const distinct = (tile: number[]) => new Set(tile).size;
  assert.equal(TILES.filter(t => distinct(t) === 1).length, 6);
  assert.equal(TILES.filter(t => distinct(t) === 2).length, 30);
  assert.equal(TILES.filter(t => distinct(t) === 3).length, 20);
});

test('every corner number is 0 to 5', () => {
  for (const tile of TILES) for (const n of tile) assert.ok(Number.isInteger(n) && n >= 0 && n <= 5);
});

test('no two tiles are rotations of each other', () => {
  const seen = new Set<string>();
  for (const tile of TILES) {
    for (const key of rotationKeys(tile)) assert.ok(!seen.has(key), `${tile} repeats a rotation`);
    seen.add(rotationKeys(tile)[0]);
  }
});

test('three different numbers ascend clockwise, so 0-2-1 has no tile', () => {
  assert.notEqual(idOf('012'), -1);
  for (const tile of TILES) assert.ok(!rotationKeys(tile).includes('021'));
});

test('tileSum of 5-5-5 is 15', () => {
  assert.equal(tileSum(idOf('555')), 15);
  assert.equal(tileSum(idOf('024')), 6);
});

test('isTriple is true for exactly 6 tiles', () => {
  assert.equal(TILES.filter((_, id) => isTriple(id)).length, 6);
  assert.ok(isTriple(idOf('000')));
  assert.ok(!isTriple(idOf('001')));
});
