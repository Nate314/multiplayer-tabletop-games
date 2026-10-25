import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_INFOS } from '../../games/infos.ts';
import { CLIENT_LOADERS, GAME_ICONS, type ClientGame } from '../clientGames.ts';
import { loadClientGame, loadedClientGame } from './loadClientGame.ts';

const fakeClient = (id: string) => ({ id }) as ClientGame;

test('two loads of one game share a single download', async () => {
  let calls = 0;
  const loaders = { shared: async () => { calls++; return fakeClient('shared'); } };
  const [a, b] = await Promise.all([loadClientGame('shared', loaders), loadClientGame('shared', loaders)]);
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.equal(loadedClientGame('shared'), a);
});

test('a failed load is forgotten, so the next load tries again', async () => {
  let calls = 0;
  const loaders = {
    flaky: async () => {
      calls++;
      if (calls === 1) throw new Error('offline');
      return fakeClient('flaky');
    }
  };
  await assert.rejects(loadClientGame('flaky', loaders), /offline/);
  assert.equal(loadedClientGame('flaky'), undefined);
  assert.equal((await loadClientGame('flaky', loaders)).id, 'flaky');
  assert.equal(calls, 2);
});

test('an unknown game rejects', async () => {
  await assert.rejects(loadClientGame('nope', {}), { message: 'Unknown game "nope"' });
});

test('every listed game has a loader and an icon', () => {
  for (const { id } of GAME_INFOS) {
    assert.equal(typeof CLIENT_LOADERS[id], 'function', id);
    assert.ok(GAME_ICONS[id], id);
  }
  assert.deepEqual(Object.keys(CLIENT_LOADERS).sort(), GAME_INFOS.map(i => i.id).sort());
});
