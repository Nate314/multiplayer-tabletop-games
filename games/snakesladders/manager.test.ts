import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys } from '../../server/testing.ts';
import { snakesladders } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'snakesladders/g1';
const ROLL: Move = { type: 'roll' };

function gameWith(random: Random, ...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([snakesladders], random));
  for (const name of names) manager.join('snakesladders', 'g1', name);
  agreeAll(manager, ROOM);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to this game's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

test('rolls are validated, rolled on the server and recorded for undo', () => {
  const manager = gameWith(() => 3.5 / 6, 'A', 'B');
  assert.deepEqual(manager.move(ROOM, 2, ROLL), { error: 'Not your turn' });

  const rolled = ok(manager.move(ROOM, 1, ROLL));
  assert.equal(rolled.positions[1], 5);
  assert.equal(rolled.undoAvailable, true);

  ok(manager.requestUndo(ROOM, 1));
  const restored = ok(manager.voteUndo(ROOM, 2, true));
  assert.equal(restored.positions[1], 1);
  assert.equal(restored.currentPlayer, 1);
});

test('a short game plays to 100', () => {
  const manager = gameWith(() => 5.5 / 6, 'A', 'B');
  let state: PublicGameState | null = null;
  for (let roll = 0; roll < 24; roll++) state = ok(manager.move(ROOM, 1, ROLL));
  assert.ok(state);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.moveCount, 24);
  assert.equal(state.positions[1], 100);
  assert.equal(state.positions[2], 1);
  assert.ok('error' in manager.move(ROOM, 1, ROLL));
});
