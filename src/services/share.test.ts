import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinLink, parseJoinLink, shareGame } from './share.ts';

const data = { title: 'Chess', url: 'http://h/join/chess/abc' };
const recorder = () => {
  const copied: string[] = [];
  return { copied, clipboard: { writeText: (text: string) => { copied.push(text); return Promise.resolve(); } } };
};

test('a join link encodes the game ID', () => {
  assert.equal(joinLink('http://h:3000', 'chess', 'fri day/#1'), 'http://h:3000/join/chess/fri%20day%2F%231');
  assert.equal(joinLink('o', 'chess', 'v1.2'), 'o/join/chess/v1%2E2');
  assert.deepEqual(parseJoinLink('/join/chess/v1%2E2', ['chess']), { gameType: 'chess', gameId: 'v1.2' });
});
test('a join link parses back to its game', () => {
  assert.deepEqual(parseJoinLink('/join/chess/fri%20day%2F%231', ['chess']), { gameType: 'chess', gameId: 'fri day/#1' });
  assert.deepEqual(parseJoinLink('/join/chess/abc/', ['chess']), { gameType: 'chess', gameId: 'abc' });
});
test('other paths are not join links', () => {
  for (const path of ['/', '/join', '/join/chess', '/join/chess/', '/join/nope/abc', '/join/chess/a/b', '/joinx/chess/a', '/join/chess/%E0%A4%A']) {
    assert.equal(parseJoinLink(path, ['chess']), null, path);
  }
});
test('the share sheet is used when there is one', async () => {
  const { copied, clipboard } = recorder();
  assert.equal(await shareGame({ share: () => Promise.resolve(), clipboard }, data), 'shared');
  assert.deepEqual(copied, []);
});
test('a cancelled share sheet does not copy', async () => {
  const { copied, clipboard } = recorder();
  const share = () => Promise.reject(new DOMException('', 'AbortError'));
  assert.equal(await shareGame({ share, clipboard }, data), 'cancelled');
  assert.deepEqual(copied, []);
});
test('a second tap while the share sheet is open does not copy', async () => {
  const { copied, clipboard } = recorder();
  const share = () => Promise.reject(new DOMException('', 'InvalidStateError'));
  assert.equal(await shareGame({ share, clipboard }, data), 'cancelled');
  assert.deepEqual(copied, []);
});
test('a failed share sheet falls back to copying', async () => {
  const { copied, clipboard } = recorder();
  assert.equal(await shareGame({ share: () => Promise.reject(new TypeError('no')), clipboard }, data), 'copied');
  assert.deepEqual(copied, [data.url]);
});
test('without a share sheet the link is copied', async () => {
  const { copied, clipboard } = recorder();
  assert.equal(await shareGame({ clipboard }, data), 'copied');
  assert.deepEqual(copied, [data.url]);
});
test('without a share sheet or clipboard the link is shown to copy by hand', async () => {
  assert.equal(await shareGame({}, data), 'manual');
  assert.equal(await shareGame({ clipboard: { writeText: () => Promise.reject(new Error('denied')) } }, data), 'manual');
});
