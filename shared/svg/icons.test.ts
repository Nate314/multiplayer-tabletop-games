import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconSvg } from './icons.ts';

test('the eye icons are line drawings in currentColor', () => {
  for (const name of ['eye', 'eye-off']) {
    const svg = iconSvg(name);
    assert.ok(svg?.startsWith('<svg'));
    assert.match(svg!, /stroke="currentColor"/);
  }
  assert.notEqual(iconSvg('eye'), iconSvg('eye-off'));
});
