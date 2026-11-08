import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { seeded } from '../testStates.ts';
import { corners } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Result } from '../../shared/types.ts';

const ROOM = 'corners/g1';

// The single square on a corner of the 20 by 20 board
const place = (dx: number, dy: number): Move => ({ type: 'place', piece: 0, orientation: 0, dx, dy });
const FIRST: [number, number][] = [[0, 0], [19, 0], [19, 19], [0, 19]];

// The manager is generic over games, so tests narrow the public state to Corners'
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

type Manager = ReturnType<typeof createGameManager>;
const current = (manager: Manager) => (manager.getState(ROOM) ?? assert.fail('no game')) as PublicGameState;

function started(board?: string) {
  const manager = rememberingKeys(createGameManager([corners], seeded(42)));
  manager.join('corners', 'g1', 'A');
  manager.join('corners', 'g1', 'B');
  if (board) ok(manager.setHouseRules(ROOM, 1, { values: { board }, maxPlayers: null }));
  agreeAll(manager, ROOM);
  return manager;
}

test('two players place the four first pieces through the manager', () => {
  const manager = started();
  const seats: number[] = [];
  for (const [dx, dy] of FIRST) {
    const state = current(manager);
    seats.push(state.currentPlayer as number);
    ok(manager.move(ROOM, state.currentPlayer as number, place(dx, dy)));
  }
  assert.deepEqual(seats, [1, 2, 1, 2]);
  const steps = (stepsOf(manager, 'corners') ?? assert.fail('no history')).filter(s => s.historyStep === 'move');
  assert.equal(steps.length, 4);
  for (const s of steps) assert.ok((s as unknown as PublicGameState).lastMove);
});

test('an undo vote takes back a placement', () => {
  const manager = started();
  ok(manager.move(ROOM, 1, place(0, 0)));
  ok(manager.move(ROOM, 2, place(19, 0)));
  ok(manager.requestUndo(ROOM, 2));
  const back = ok(manager.voteUndo(ROOM, 1, true));
  assert.equal(back.placed.length, 1);
  assert.equal(back.currentPlayer, 2);
});

test('the Board house rule switches to triangles before the start', () => {
  const manager = rememberingKeys(createGameManager([corners], seeded(42)));
  manager.join('corners', 'g1', 'A');
  manager.join('corners', 'g1', 'B');
  assert.equal(current(manager).board, 'squares');
  ok(manager.setHouseRules(ROOM, 1, { values: { board: 'triangles' }, maxPlayers: null }));
  assert.equal(current(manager).board, 'triangles');
});
