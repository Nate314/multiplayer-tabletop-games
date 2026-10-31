import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf, fileOf } from '../../server/testing.ts';
import type { HouseRuleValues } from '../../shared/houseRules.ts';
import { jenga } from './index.ts';
import { IDENTITY, anchorWorld } from './physics.ts';
import type { GameState, PublicGameState, Seat, Vec3 } from './types.ts';
import type { Result } from '../../shared/types.ts';

const ROOM = 'jenga/g1';
// Middle of level 7, which runs along Z; local +X is its long axis
const MIDDLE = 22;
const END: Vec3 = [3.75, 0, 0];

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

// Everyone joins and agrees to the house rules, after Alice sets `values` if given
function game(values?: HouseRuleValues) {
  const manager = rememberingKeys(createGameManager([jenga], () => 0.5, undefined, { manualSimulation: true }));
  for (const name of ['Alice', 'Bob', 'Cat']) manager.join('jenga', 'g1', name);
  if (values) ok(manager.setHouseRules(ROOM, 1, { values, maxPlayers: null }));
  agreeAll(manager, ROOM);
  return manager;
}

type Manager = ReturnType<typeof game>;
const raw = (manager: Manager) => manager.rawState(ROOM) as GameState;

// Drags a middle block straight out until it is in hand, then lets the tower settle
function pullOut(manager: Manager, seat: Seat = 1, id = MIDDLE) {
  ok(manager.action(ROOM, seat, { type: 'grab', block: id, anchor: END }));
  for (let tick = 0; tick < 400 && raw(manager).held === null; tick++) {
    const block = raw(manager).blocks.find(b => b.id === id)!;
    ok(manager.action(ROOM, seat, { type: 'drag', target: anchorWorld(block, [100, 0, 0]) }));
    manager.simulateTicks(ROOM, 1);
  }
  assert.equal(raw(manager).held, id);
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
  const history = stepsOf(manager, 'jenga')!;
  assert.equal(history.length, 2);
  assert.deepEqual(history.map(step => step.historyStep), ['start', 'move']);
  assert.equal((history[1] as unknown as PublicGameState).lastMove?.type, 'place');
});

test('a free drop is one recorded move and undo puts the whole turn back', () => {
  const manager = game({ freePlacement: true });
  pullOut(manager);
  manager.simulateTicks(ROOM, 400);
  const dropped = ok(manager.move(ROOM, 1, { type: 'drop', at: [0, 0] }));
  assert.equal(dropped.moveCount, 1);
  assert.equal(dropped.dropping, MIDDLE);
  manager.simulateTicks(ROOM, 400);
  assert.equal(raw(manager).sim, null);
  assert.equal(raw(manager).currentPlayer, 2);
  const history = stepsOf(manager, 'jenga')!;
  assert.deepEqual(history.map(step => step.historyStep), ['start', 'move']);
  const lastMove = (history[1] as unknown as PublicGameState).lastMove;
  assert.equal(lastMove?.type === 'place' && lastMove.free, true);
  ok(manager.requestUndo(ROOM, 2));
  ok(manager.voteUndo(ROOM, 1, true));
  const undone = ok(manager.voteUndo(ROOM, 3, true));
  assert.equal(undone.currentPlayer, 1);
  assert.equal(undone.phase, 'pull');
  assert.equal(undone.held, null);
  assert.equal(undone.dropping, null);
  assert.equal(undone.blocks.length, 54);
  assert.deepEqual(raw(manager).blocks, raw(manager).turnStart);
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
  const history = stepsOf(manager, 'jenga')!;
  assert.equal(history.length, 2);
  assert.deepEqual((history.at(-1) as unknown as PublicGameState).lastMove, { type: 'topple', seat: 1 });
});

test('a placement that topples at once records the place step, then the topple step, and undo restores the placer\'s turn start', () => {
  const manager = game();
  pullOut(manager);
  manager.simulateTicks(ROOM, 400);
  const state = raw(manager);
  // Block 0 a level higher at the turn start, so the check after placing sees it fallen
  const turnStart = state.turnStart.map(b => b.id === 0 ? { ...b, pose: { ...b.pose, p: [b.pose.p[0], b.pose.p[1] + 1.5, b.pose.p[2]] as Vec3 } } : b);
  manager.replaceState(ROOM, { ...state, turnStart } as GameState);
  ok(manager.move(ROOM, 1, { type: 'place', slot: 0 }));
  manager.simulateTicks(ROOM, 400);
  assert.equal(raw(manager).isGameOver, true);
  const history = stepsOf(manager, 'jenga')!;
  assert.deepEqual(history.map(step => (step as unknown as PublicGameState).lastMove?.type ?? null), [null, 'place', 'topple']);
  ok(manager.requestUndo(ROOM, 2));
  ok(manager.voteUndo(ROOM, 1, true));
  const undone = ok(manager.voteUndo(ROOM, 3, true));
  assert.equal(undone.currentPlayer, 1);
  assert.equal(undone.toppled, false);
  assert.deepEqual(raw(manager).blocks, turnStart);
});

test('a collapse whose tick throws still ends and records the game instead of staying stuck', (t) => {
  t.mock.method(console, 'error', () => {});
  const manager = game();
  topple(manager);
  ok(manager.requestUndo(ROOM, 2));
  ok(manager.voteUndo(ROOM, 1, true));
  ok(manager.voteUndo(ROOM, 3, true));
  const state = raw(manager);
  // A block with no rotation cannot be built into a world, so every tick of this collapse throws
  const broken = { id: 99, level: 0, pose: { p: [0, 0, 0], q: null } };
  manager.replaceState(ROOM, { ...state, blocks: [...state.blocks, broken], toppled: true, loser: 1, sim: { ticks: 0, calmTicks: 0, sinceRelease: 0 } } as unknown as GameState);
  manager.simulateTicks(ROOM, 1);
  assert.equal(raw(manager).sim, null);
  assert.equal(raw(manager).isGameOver, true);
  assert.deepEqual(raw(manager).lastMove, { type: 'topple', seat: 1 });
  assert.deepEqual(raw(manager).winners, [2, 3]);
});

test('the table view and the game file never contain grip values', () => {
  const manager = game();
  topple(manager);
  assert.equal(JSON.stringify(stepsOf(manager, 'jenga')).includes('"grip"'), false);
  const file = fileOf(manager, 'jenga', new Date(0));
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

// Turns the table at `speed` for a few ticks, then lets go and lets it coast to a stop
function turnTable(manager: Manager, seat: Seat, speed: number) {
  ok(manager.action(ROOM, seat, { type: 'turn', speed }));
  manager.simulateTicks(ROOM, 5);
  ok(manager.action(ROOM, seat, { type: 'turn', speed: null }));
  manager.simulateTicks(ROOM, 400);
  assert.equal(raw(manager).sim, null);
}

test('undo restores the turntable angle a turn started from', () => {
  const manager = game();
  turnTable(manager, 1, 1);
  pullOut(manager);
  manager.simulateTicks(ROOM, 400);
  ok(manager.move(ROOM, 1, { type: 'place', slot: 0 }));
  const afterAlice = raw(manager).turntable!.q;
  assert.notDeepEqual(afterAlice, IDENTITY);
  // Bob's turn starts where Alice left the table; he turns it on, then his place is undone
  turnTable(manager, 2, 1);
  pullOut(manager, 2, 19);
  manager.simulateTicks(ROOM, 400);
  ok(manager.move(ROOM, 2, { type: 'place', slot: 1 }));
  assert.notDeepEqual(raw(manager).turntable!.q, afterAlice);
  ok(manager.requestUndo(ROOM, 3));
  ok(manager.voteUndo(ROOM, 1, true));
  ok(manager.voteUndo(ROOM, 2, true));
  assert.deepEqual(raw(manager).turntable, { q: afterAlice, w: 0, drive: null });
  assert.equal(raw(manager).currentPlayer, 2);
});
