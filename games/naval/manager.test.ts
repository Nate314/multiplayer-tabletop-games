import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, fileOf, rememberingKeys, stepsOf } from '../../server/testing.ts';
import { naval } from './index.ts';
import { randomFleet, shipCells } from './fleet.ts';
import { shipsIn } from './testing.ts';
import { seeded } from '../testStates.ts';
import type { Cell, PublicGameState, Seat, Ship } from './types.ts';
import type { Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'naval/g1';
const FLEETS: Record<Seat, Ship[]> = { 1: randomFleet(seeded(1)), 2: randomFleet(seeded(2)) };
const ALICE_TARGETS = FLEETS[2].flatMap(shipCells);
const BOB_TARGETS = Array.from({ length: 100 }, (_, i): Cell => ({ row: Math.floor(i / 10), col: i % 10 }));
const SINKING = FLEETS[2][0].length - 1; // the index of Alice's shot that sinks Bob's first ship

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function joined(): Manager {
  const manager = rememberingKeys(createGameManager([naval], seeded(3)));
  for (const name of ['Alice', 'Bob']) manager.join('naval', 'g1', name);
  agreeAll(manager, ROOM);
  return manager;
}

const place = (manager: Manager, seat: Seat) => ok(manager.action(ROOM, seat, { type: 'place', ships: FLEETS[seat] }));
const fire = (manager: Manager, seat: Seat, target: Cell) => ok(manager.move(ROOM, seat, { type: 'fire', targets: [target] }));

// Both fleets placed and `aliceShots` shots by Alice, each answered by Bob unless it won
function played(aliceShots: number): Manager {
  const manager = joined();
  place(manager, 1);
  place(manager, 2);
  for (let i = 0; i < aliceShots; i++) {
    if (fire(manager, 1, ALICE_TARGETS[i]).isGameOver) break;
    fire(manager, 2, BOB_TARGETS[i]);
  }
  return manager;
}

const view = (manager: Manager, viewer: Seat | null) => manager.getState(ROOM, viewer) as PublicGameState;
// The live clock and the platform's "Last turn undone" status differ after an undo, so they are left out when comparing views
function steady(state: PublicGameState) {
  const { serverTime: _serverTime, gameStatus: _gameStatus, ...rest } = state;
  return rest;
}

test('a short game plays to a win', () => {
  const state = view(played(ALICE_TARGETS.length), null);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.moveCount, ALICE_TARGETS.length * 2 - 1);
});

test('placing is not a move and starts the game', () => {
  const manager = joined();
  place(manager, 1);
  const state = place(manager, 2);
  assert.equal(state.moveCount, 0);
  assert.equal(state.started, true);
  assert.equal(state.undoAvailable, false);
});

test('History never shows a fleet before the game ends', () => {
  const manager = played(SINKING + 3);
  assert.deepEqual(shipsIn(stepsOf(manager, 'naval') ?? assert.fail('no history')), []);
  fire(manager, 1, ALICE_TARGETS[SINKING + 3]);
  for (let i = SINKING + 4; i < ALICE_TARGETS.length; i++) {
    fire(manager, 2, BOB_TARGETS[i - 1]);
    fire(manager, 1, ALICE_TARGETS[i]);
  }
  const steps = stepsOf(manager, 'naval') ?? assert.fail('no history');
  assert.equal(steps.at(-1)?.isGameOver, true);
  assert.deepEqual(shipsIn(steps.slice(0, -1)), []);
});

test('a game file is refused until game over, then keeps each fleet in its own seat\'s views', () => {
  const manager = played(SINKING + 3);
  assert.deepEqual(fileOf(manager, 'naval', new Date()), { error: 'The game is not over yet' });
  const over = played(ALICE_TARGETS.length);
  const file = fileOf(over, 'naval', new Date());
  assert.ok('file' in file);
  const steps = file.file.steps.slice(0, -1);
  assert.ok(steps.length > 0);
  for (const { views, ...table } of steps) {
    assert.deepEqual(shipsIn(table), []);
    assert.deepEqual(shipsIn(views?.['1']), FLEETS[1]);
    assert.deepEqual(shipsIn(views?.['2']), FLEETS[2]);
  }
});

test('an undo never reveals a ship', () => {
  const manager = played(SINKING);
  const before = view(manager, 2);
  const sank = fire(manager, 1, ALICE_TARGETS[SINKING]);
  assert.equal(sank.shots[1].at(-1)?.result, 'sunk');
  ok(manager.requestUndo(ROOM, 1));
  ok(manager.voteUndo(ROOM, 2, true));
  assert.deepEqual(steady(view(manager, 2)), steady(before));
  assert.deepEqual(shipsIn(view(manager, 1)), FLEETS[1]);
  assert.deepEqual(shipsIn(manager.getState(ROOM, null)), []);

  const won = played(ALICE_TARGETS.length);
  assert.deepEqual(view(won, null).revealed, FLEETS);
  ok(won.requestUndo(ROOM, 1));
  ok(won.voteUndo(ROOM, 2, true));
  for (const viewer of [null, 1, 2] as (Seat | null)[]) assert.deepEqual(view(won, viewer).revealed, {}, `viewer ${viewer}`);
  assert.equal(view(won, null).isGameOver, false);
});

test('a rejoin after confirming gets the confirmed fleet back', () => {
  const manager = joined();
  place(manager, 1);
  manager.disconnect(ROOM, 1);
  const result = manager.join('naval', 'g1', 'Alice', true);
  assert.ok('state' in result, 'error' in result ? result.error : 'no state');
  const state = result.state as PublicGameState;
  assert.deepEqual(state.myFleet, FLEETS[1]);
  assert.deepEqual(state.ready, [1]);
});
