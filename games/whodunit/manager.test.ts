import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, fileOf, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';
import { whodunit } from './index.ts';
import type { GameState, PublicGameState, Seat, Solution } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;
const ROOM = 'whodunit/g1';
const SOLUTION: Solution = { suspect: 'commodore-brine', object: 'harpoon', room: 'boathouse' };
const SUGGEST = { type: 'suggest', suspect: 'miss-gull', object: 'boat-oar' };

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

const raw = (manager: Manager) => manager.rawState(ROOM) as GameState;

// Three seated players, seat 1 (Commodore Brine) in the Galley ready to suggest; seat 2 holds the Boat Oar and the Galley,
// so it must choose which to show. Seat 3 holds nothing asked about
function gameInRoom(): Manager {
  const manager = rememberingKeys(createGameManager([whodunit], seeded(5)));
  for (const name of ['Alice', 'Bob', 'Cara']) manager.join('whodunit', 'g1', name);
  agreeAll(manager, ROOM);
  const state = raw(manager);
  Object.assign(state, {
    solution: SOLUTION,
    hands: { 1: ['miss-gull', 'boathouse'], 2: ['boat-oar', 'galley', 'anchor-chain'], 3: ['wine-cellar'] },
    positions: { ...state.positions, 'commodore-brine': { room: 'galley' } }
  });
  ok(manager.move(ROOM, 1, { type: 'roll' }));
  Object.assign(raw(manager), { phase: 'room', destinations: [] });
  return manager;
}

test('a game plays to a right accusation', () => {
  const manager = gameInRoom();
  ok(manager.move(ROOM, 1, SUGGEST));
  ok(manager.move(ROOM, 2, { type: 'show', card: 'boat-oar' }));
  ok(manager.move(ROOM, 1, { type: 'endTurn' }));
  const seat = ok(manager.move(ROOM, 2, { type: 'roll' })).currentPlayer as Seat;
  assert.equal(seat, 2);
  Object.assign(raw(manager), { phase: 'end', destinations: [] });
  const done = ok(manager.move(ROOM, 2, { type: 'accuse', ...SOLUTION }));
  assert.equal(done.isGameOver, true);
  assert.deepEqual(done.winners, [2]);
  assert.deepEqual(done.solution, SOLUTION);
  const file = fileOf(manager, 'whodunit', new Date(0));
  if (!file || 'error' in file) assert.fail('expected a game file');
});

test('no history step shows a hand or a shown card', () => {
  const manager = gameInRoom();
  ok(manager.move(ROOM, 1, SUGGEST));
  assert.equal(raw(manager).phase, 'showing');
  ok(manager.move(ROOM, 2, { type: 'show', card: 'boat-oar' }));
  const steps = stepsOf(manager, 'whodunit') ?? assert.fail('no history');
  assert.ok(steps.length >= 3);
  for (const step of steps) {
    const view = step as unknown as PublicGameState;
    assert.deepEqual([view.hand, view.seen, view.solution], [[], [], null]);
  }
});

test('Undo is refused right after a card is shown', () => {
  const manager = gameInRoom();
  ok(manager.move(ROOM, 1, SUGGEST));
  ok(manager.move(ROOM, 2, { type: 'show', card: 'boat-oar' }));
  assert.ok('error' in manager.requestUndo(ROOM, 1));
});

test('a disconnect and rejoin keeps the hand', () => {
  const manager = gameInRoom();
  const before = (manager.getState(ROOM, 2) as PublicGameState).hand;
  manager.disconnect(ROOM, 2);
  const rejoined = manager.join('whodunit', 'g1', 'Bob', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = manager.getState(ROOM, 2) as PublicGameState;
  assert.deepEqual(view.hand, before);
  assert.deepEqual(view.faceUp, { 1: [], 2: [], 3: [] }); // nobody was dismissed
});
