import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg, reedSolomon, formatBits, versionBits } from './qr.ts';

test('reed-solomon matches the HELLO WORLD 1-M example', () => {
  assert.deepEqual(
    reedSolomon([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10),
    [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('format bits for M with mask 0', () => {
  assert.equal(formatBits(0), 0b101010000010010);
});

test('version bits for version 7', () => {
  assert.equal(versionBits(7), 0b000111110010010100);
});

test('picks the smallest version', () => {
  assert.equal(qrMatrix('https://example.com/join/chess/fun1')?.length, 29);
  assert.equal(qrMatrix('a'.repeat(213))?.length, 57);
  assert.equal(qrMatrix('a'.repeat(214)), null);
  assert.equal(qrMatrix(''), null);
});

test('fixed patterns are in place', () => {
  const matrix = qrMatrix('a'.repeat(110))!;
  const size = matrix.length;
  assert.equal(size, 45);
  for (const [r0, c0] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const ring = r === 0 || r === 6 || c === 0 || c === 6;
      const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      assert.equal(matrix[r0 + r][c0 + c], ring || center, `finder ${r0},${c0} at ${r},${c}`);
    }
  }
  for (let c = 8; c <= size - 9; c++) assert.equal(matrix[6][c], c % 2 === 0, `timing column ${c}`);
  assert.equal(matrix[4 * 7 + 9][8], true);
});

test('qrSvg draws one path in a quiet zone', () => {
  const svg = qrSvg('https://example.com/join/chess/fun1')!;
  assert.match(svg, /viewBox="0 0 37 37"/);
  assert.equal(svg.split('<path').length - 1, 1);
});
