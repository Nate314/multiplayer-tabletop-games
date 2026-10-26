import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floodFill } from './fill.ts';

const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];
const RED: [number, number, number, number] = [224, 49, 49, 255];

// A width x height image of one color, with `paint` setting single pixels
function image(width: number, height: number, color = WHITE) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) pixels.set(color, i * 4);
  const at = (x: number, y: number) => [...pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];
  const paint = (x: number, y: number, rgba: number[]) => pixels.set(rgba, (y * width + x) * 4);
  return { pixels, at, paint };
}

test('fills a closed region and stops at its border', () => {
  const { pixels, at, paint } = image(7, 7);
  // A black square outline from (1,1) to (5,5)
  for (let i = 1; i <= 5; i++) { paint(i, 1, BLACK); paint(i, 5, BLACK); paint(1, i, BLACK); paint(5, i, BLACK); }
  floodFill(pixels, 7, 7, 3, 3, RED);
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) assert.deepEqual(at(x, y), RED, `inside ${x},${y}`);
  assert.deepEqual(at(1, 3), BLACK);
  assert.deepEqual(at(0, 0), WHITE);
  assert.deepEqual(at(6, 3), WHITE);
});

test('fills across antialiased pixels within the tolerance', () => {
  const { pixels, at, paint } = image(5, 1);
  paint(2, 0, [235, 235, 235, 255]); // a light gray edge pixel
  paint(4, 0, [120, 120, 120, 255]); // far from white: a border
  floodFill(pixels, 5, 1, 0, 0, RED);
  assert.deepEqual([0, 1, 2, 3].map(x => at(x, 0)), [RED, RED, RED, RED]);
  assert.deepEqual(at(4, 0), [120, 120, 120, 255]);
});

test('a fill outside the image does nothing', () => {
  const { pixels } = image(4, 4);
  const before = [...pixels];
  for (const [x, y] of [[4, 0], [0, 4], [-1, 0], [4, 4]]) floodFill(pixels, 4, 4, x, y, RED);
  assert.deepEqual([...pixels], before);
});

test('a fill on the same color does nothing', () => {
  const { pixels } = image(4, 4, RED);
  const before = [...pixels];
  floodFill(pixels, 4, 4, 1, 1, RED);
  assert.deepEqual([...pixels], before);
});
