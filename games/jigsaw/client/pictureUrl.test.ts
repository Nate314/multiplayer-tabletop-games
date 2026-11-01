import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pictureUrl } from './pictureUrl.ts';

test('pictureUrl names a built-in asset or an uploaded image', () => {
  assert.equal(pictureUrl({ kind: 'builtin', name: 'fox' }), '/api/svg/jigsaw-picture/fox');
  const id = '0123456789abcdef0123456789abcdef';
  assert.equal(pictureUrl({ kind: 'photo', id }), `/api/images/${id}`);
});
