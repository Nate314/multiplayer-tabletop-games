import { test } from 'node:test';
import assert from 'node:assert/strict';
import { el, escapeText, svgDoc } from './svg.ts';

test('el escapes attribute values and omits undefined ones', () => {
  assert.equal(el('rect', { x: 1, fill: 'a"b' }), '<rect x="1" fill="a&quot;b"/>');
  assert.equal(el('rect', { x: 1, y: undefined }), '<rect x="1"/>');
});

test('el nests children', () => {
  assert.equal(el('g', {}, el('circle', { r: 2 })), '<g><circle r="2"/></g>');
});

test('escapeText escapes markup', () => {
  assert.equal(escapeText('<b>&'), '&lt;b&gt;&amp;');
});

test('svgDoc is a full svg document with its view box', () => {
  assert.equal(svgDoc('0 0 10 10', {}, '<g/>'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g/></svg>');
});
