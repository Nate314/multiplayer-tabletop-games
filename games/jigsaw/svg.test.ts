import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { PICTURES } from './pictures.ts';
import { JIGSAW_ASSETS, pictureSvg } from './svg.ts';

test('every picture draws a 1440 by 960 document', () => {
  for (const { name } of PICTURES) {
    const svg = pictureSvg(name) ?? '';
    assert.ok(svg.startsWith('<svg'), name);
    assert.ok(svg.includes('viewBox="0 0 1440 960"'), name);
  }
});

test('pictures use fixed colors', () => {
  for (const { name } of PICTURES) {
    const svg = pictureSvg(name) ?? '';
    assert.ok(!svg.includes('var('), name);
    assert.ok(!svg.includes('currentColor'), name);
  }
});

test('an unknown name draws nothing', () => {
  assert.equal(pictureSvg('nope'), null);
  assert.equal(pictureSvg('toString'), null);
});

test('there are at least 8 distinct pictures', () => {
  const drawn = new Set(PICTURES.map(({ name }) => pictureSvg(name)));
  assert.ok(drawn.size >= 8);
  assert.equal(JIGSAW_ASSETS[0].name, 'jigsaw-picture');
  assert.equal(JIGSAW_ASSETS[0].samples.length, PICTURES.length);
});

test('no client file imports svg.ts', () => {
  const dir = new URL('./client/', import.meta.url);
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const path = new URL(file, dir);
    if (!fs.statSync(path).isFile()) continue;
    assert.ok(!/from '\.\.\/svg\.ts'/.test(fs.readFileSync(path, 'utf8')), file);
  }
});
