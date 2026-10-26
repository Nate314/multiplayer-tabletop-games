import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { jenga } from './index.ts';
import { anchorWorld } from './physics.ts';
import type { GameState, PublicGameState, Vec3 } from './types.ts';
import type { Result } from '../../shared/types.ts';

const ROOM = 'jenga/g1';
// Middle of level 7, which runs along Z; local +X is its long axis
const MIDDLE = 22;
const END: Vec3 = [3.75, 0, 0];

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function game() {
  const manager = rememberingKeys(createGameManager([jenga], () => 0.5, undefined, { manualSimulation: true }));
  for (const name of ['Alice', 'Bob', 'Cat']) manager.join('jenga', 'g1', name);
  return manager;
}

type Manager = ReturnType<typeof game>;
const raw = (manager: Manager) => manager.rawState(ROOM) as GameState;

// Drags the middle block straight out until it is in hand, then lets the tower settle
function pullOut(manager: Manager) {
  ok(manager.action(ROOM, 1, { type: 'grab', block: MIDDLE, anchor: END }));
  for (let tick = 0; tick < 400 && raw(manager).held === null; tick++) {
    const block = raw(manager).blocks.find(b => b.id === MIDDLE)!;
    ok(manager.action(ROOM, 1, { type: 'drag', target: anchorWorld(block, [100, 0, 0]) }));
    manager.simulateTicks(ROOM, 1);
  }
  assert.equal(raw(manager).held, MIDDLE);
}

// Takes away the middle and one side of level 1, which leaves the tower on one edge, and lets it fall
function topple(manager: Manager) {
  ok(manager.action(ROOM, 1, { type: 'grab', block: MIDDLE, anchor: END }));
  const state = raw(manager);
  manager.replaceState(ROOM, { ...state, blocks: state.blocks.filter(b => b.id !== 4 && b.id !== 5) } as GameState);
  ok(manager.action(ROOM, 1, { type: 'release' }));
  manager.simulateTicks(ROOM, 400);
  assert.equal(raw(manager).sim, null);
}

test('a whole turn is one move: grabs and drags are not on the timeline', () => {
  const manager = game();
  pullOut(manager);
  manager.simulateTicks(ROOM, 400);
  const placed = ok(manager.move(ROOM, 1, { type: 'place', slot: 0 }));
  assert.equal(placed.moveCount, 1);
  assert.equal(placed.currentPlayer, 2);
  const history = manager.history('jenga', 'g1')!;
  assert.equal(history.length, 2);
  assert.deepEqual(history.map(step => step.historyStep), ['start', 'move']);
  assert.equal((history[1] as unknown as PublicGameState).lastMove?.type, 'place');
});

test('a placement is refused while the simulation still runs', () => {
  const manager = game();
  pullOut(manager);
  assert.notEqual(raw(manager).sim, null);
  assert.deepEqual(manager.move(ROOM, 1, { type: 'place', slot: 0 }), { error: 'Wait for the tower to settle' });
  manager.simulateTicks(ROOM, 400);
  ok(manager.move(ROOM, 1, { type: 'place', slot: 0 }));
});

test('toppling the tower ends the game with a recorded topple step and everyone else winning', () => {
  const manager = game();
  topple(manager);
  const state = raw(manager);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2, 3]);
  const history = manager.history('jenga', 'g1')!;
  assert.equal(history.length, 2);
  assert.deepEqual((history.at(-1) as unknown as PublicGameState).lastMove, { type: 'topple', seat: 1 });
});

test('the table view and the game file never contain grip values', () => {
  const manager = game();
  topple(manager);
  assert.equal(JSON.stringify(manager.history('jenga', 'g1')).includes('"grip"'), false);
  const file = manager.gameFile('jenga', 'g1', new Date(0));
  assert.ok(file && 'file' in file);
  assert.equal(JSON.stringify(file).includes('"grip"'), false);
  assert.equal(JSON.stringify(file).includes('"turnStart"'), false);
  assert.equal(JSON.stringify(manager.getState(ROOM)).includes('"grip"'), false);
});

test('undo after a topple restores the toppler\'s turn start', () => {
  const manager = game();
  topple(manager);
  ok(manager.requestUndo(ROOM, 2));
  ok(manager.voteUndo(ROOM, 1, true));
  const undone = ok(manager.voteUndo(ROOM, 3, true));
  assert.equal(undone.isGameOver, false);
  assert.equal(undone.toppled, false);
  assert.equal(undone.currentPlayer, 1);
  assert.equal(undone.blocks.length, 54);
  assert.equal(undone.grab, null);
  assert.equal(undone.sim, null);
  const state = raw(manager);
  assert.deepEqual(state.blocks, state.turnStart);
  assert.equal(undone.gameStatus, 'Last turn undone');
  // The restored tower is playable again
  ok(manager.action(ROOM, 1, { type: 'grab', block: MIDDLE, anchor: END }));
  manager.simulateTicks(ROOM, 1);
  assert.equal(raw(manager).toppled, false);
});
