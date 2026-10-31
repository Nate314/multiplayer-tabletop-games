import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { jenga } from './index.ts';
import {
  applyAction, canPull, jengaStandings, onPlayerDisconnected, onPlayerLeft, onUndo, openSlots, placementTargets, simulate, simulating, topLevel,
  turntableOf,
} from './rules.ts';
import { forgetWorld } from './simulation.ts';
import { IDENTITY, MAX_REACH, MAX_SPIN, QUARTER_TURN, REST_TURNTABLE, anchorWorld, fromTable } from './physics.ts';
import { addPlayer, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import type { Block, GameState, Pose, Quat, Seat, Vec3 } from './types.ts';

// Middle of level 7, which runs along Z; local +X is its long axis
const MIDDLE = 22;
const END: Vec3 = [3.75, 0, 0];

function lobby(random: () => number = () => 0.5, names = ['Alice', 'Bob']): GameState {
  let state = jenga.createGameState('g1');
  for (const name of names) {
    const result = addPlayer(jenga, state, name, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

function act(state: GameState, seat: Seat, action: unknown): GameState {
  const result = applyAction(state, seat, action);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const refusal = (state: GameState, seat: Seat, action: unknown) => {
  const result = applyAction(state, seat, action);
  return 'error' in result ? result.error : 'accepted';
};

const block = (state: GameState, id: number) => state.blocks.find(b => b.id === id)!;
// A point far beyond the block's end, along its long axis
const far = (state: GameState, id: number) => anchorWorld(block(state, id), [100, 0, 0]);
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Drags the grabbed block outward every tick until `done`, or fails after `limit` ticks
function dragUntil(state: GameState, done: (s: GameState) => boolean, limit = 400): GameState {
  for (let tick = 0; tick < limit; tick++) {
    if (done(state)) return state;
    if (state.grab) state = act(state, 1, { type: 'drag', target: far(state, state.grab.block) });
    state = simulate(state);
  }
  assert.fail(`not done after ${limit} ticks`);
}

test('a new game has the full tower, Alice to pull and every grip between 0.35 and 0.65 after the lobby reset', () => {
  const state = lobby(Math.random);
  assert.equal(state.blocks.length, 54);
  assert.equal(topLevel(state.blocks), 17);
  assert.deepEqual(openSlots(state.blocks), [0, 1, 2]);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.phase, 'pull');
  assert.equal(state.sim, null);
  assert.deepEqual(state.placed, { 1: 0, 2: 0 });
  assert.equal(state.grip.length, 54);
  assert.ok(state.grip.every(g => g >= 0.35 && g <= 0.65 && Number(g.toFixed(2)) === g), String(state.grip));
  assert.deepEqual(lobby(() => 0).grip, Array(54).fill(0.35));
  assert.deepEqual(state.turnStart, state.blocks);
});

test('no view, for a seat or the table, contains grip or turnStart', () => {
  const state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  for (const viewer of [1, 2, null]) {
    const view = jenga.toPublicState(state, false, viewer);
    assert.equal('grip' in view, false);
    assert.equal('turnStart' in view, false);
    assert.equal(JSON.stringify(view).includes('grip'), false);
  }
});

test('views round positions to 3 places and drop velocities of blocks at rest', () => {
  const moving: Block = { id: 0, level: 0, pose: { p: [1.23456, 0.75, -0.00049], q: [0.123456, 0, 0, 0.99234567] }, v: [3.14159, 0, 0], w: [0, 0, 0] };
  const still: Block = { id: 1, level: 0, pose: { p: [0, 0.75, 0], q: [0, 0, 0, 1] }, v: [0.001, 0, 0], w: [0, 0.001, 0] };
  const view = jenga.toPublicState({ ...lobby(), blocks: [moving, still] }, false, 1);
  assert.deepEqual(view.blocks[0], { id: 0, level: 0, pose: { p: [1.235, 0.75, -0], q: [0.1235, 0, 0, 0.9923] }, v: [3.142, 0, 0], w: [0, 0, 0] });
  assert.deepEqual(view.blocks[1], { id: 1, level: 0, pose: { p: [0, 0.75, 0], q: [0, 0, 0, 1] } });
});

test('only the current player may grab, and only a legal block', () => {
  const state = lobby();
  assert.equal(refusal(state, 2, { type: 'grab', block: MIDDLE, anchor: END }), 'Not your turn');
  assert.equal(refusal(state, 1, { type: 'grab', block: 53, anchor: END }), 'You cannot take a block from the top level');
  assert.equal(refusal(state, 1, { type: 'grab', block: 48, anchor: END }), 'accepted');
  const incomplete = { ...state, blocks: state.blocks.filter(b => b.id !== 53) };
  assert.equal(refusal(incomplete, 1, { type: 'grab', block: 48, anchor: END }), 'You cannot take a block from the level under an incomplete top');
  assert.equal(refusal(incomplete, 1, { type: 'grab', block: 45, anchor: END }), 'accepted');
  assert.equal(canPull(incomplete, 45), true);
  assert.equal(canPull(incomplete, 48), false);
  assert.deepEqual(openSlots(incomplete.blocks), [2]);
  for (const bad of [{ block: 99, anchor: END }, { block: MIDDLE, anchor: [3.8, 0, 0] }, { block: MIDDLE, anchor: [0, NaN, 0] }, { block: '22', anchor: END }, { block: MIDDLE }]) {
    assert.equal(refusal(state, 1, { type: 'grab', ...bad }), 'Invalid block', JSON.stringify(bad));
  }
  assert.equal(refusal(state, 1, { type: 'wave' }), 'Unknown action type');
});

test('a grab starts the game and the simulation', () => {
  const state = lobby();
  assert.equal(simulating(state), false);
  const grabbed = act(state, 1, { type: 'grab', block: MIDDLE, anchor: END });
  assert.equal(grabbed.started, true);
  assert.equal(simulating(grabbed), true);
  assert.deepEqual(grabbed.pull, { seat: 1, block: MIDDLE });
  assert.deepEqual(grabbed.grab, { block: MIDDLE, anchor: END, target: anchorWorld(block(state, MIDDLE), END) });
  assert.equal(grabbed.gameStatus, 'Alice is pulling a block');
});

test('a grab is refused during a vote, after a topple and while a block is in hand', () => {
  const state = lobby();
  const grab = { type: 'grab', block: MIDDLE, anchor: END };
  assert.equal(refusal({ ...state, undoVote: { requestedBy: 2, votes: { 2: true } } }, 1, grab), 'An undo vote is in progress');
  assert.equal(refusal({ ...state, dismissVote: { target: 2, requestedBy: 1, votes: { 1: true } } }, 1, grab), 'A dismiss vote is in progress');
  assert.equal(refusal({ ...state, toppled: true, loser: 1 }, 1, grab), 'The tower has toppled');
  assert.equal(refusal({ ...state, isGameOver: true }, 1, grab), 'The game is over');
  assert.equal(refusal({ ...state, phase: 'place', held: 10 }, 1, grab), 'Place the block you are holding first');
  const alone = jenga.createGameState('g2');
  assert.equal(refusal(jenga.resetLobby({ ...alone, activePlayers: [1], playerNames: { 1: 'Alice' }, currentPlayer: 1 }, () => 0.5), 1, grab), 'Waiting for more players');
});

test('a drag target far from the block is clamped', () => {
  const grabbed = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  const anchor = anchorWorld(block(grabbed, MIDDLE), END);
  const dragged = act(grabbed, 1, { type: 'drag', target: [anchor[0], 50, anchor[2] + 1000] });
  const target = dragged.grab!.target;
  assert.ok(Math.abs(distance(target, anchor) - MAX_REACH) < 1e-9, String(target));
  assert.equal(target[1], anchor[1]);
  assert.equal(refusal(lobby(), 1, { type: 'drag', target: anchor }), 'You are not holding a block');
});

test('a non-finite drag target is refused', () => {
  const grabbed = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  for (const target of [[NaN, 0, 0], [0, Infinity, 0], ['1', 0, 0], [0, 0], null, 'far']) {
    assert.equal(refusal(grabbed, 1, { type: 'drag', target }), 'Invalid target', JSON.stringify(target));
  }
  assert.equal(refusal(grabbed, 2, { type: 'drag', target: [0, 0, 0] }), 'Not your turn');
});

test('releasing and grabbing another block is allowed, and the last grabbed is the exempt one', () => {
  let state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  state = simulate(act(state, 1, { type: 'drag', target: far(state, MIDDLE) }));
  state = act(state, 1, { type: 'release' });
  assert.equal(state.grab, null);
  assert.deepEqual(state.pull, { seat: 1, block: MIDDLE });
  assert.equal(state.gameStatus, "Alice's turn to pull a block");
  assert.equal(refusal(state, 1, { type: 'release' }), 'You are not holding a block');
  state = act(state, 1, { type: 'grab', block: 19, anchor: END });
  assert.deepEqual(state.pull, { seat: 1, block: 19 });
  // A drop of block 19 itself is not a topple, the same drop of block 22 is
  const sunk = (id: number) => state.blocks.map(b => b.id === id ? { ...b, pose: { ...b.pose, p: [b.pose.p[0], b.pose.p[1] - 1, b.pose.p[2]] as Vec3 } } : b);
  assert.equal(simulate({ ...state, turnStart: sunk(19).map((b, i) => b.id === 19 ? state.turnStart[i] : b) }).toppled, false);
  assert.equal(simulate({ ...state, turnStart: state.turnStart.map(b => b.id === MIDDLE ? { ...b, pose: { ...b.pose, p: [b.pose.p[0], b.pose.p[1] + 1, b.pose.p[2]] as Vec3 } } : b) }).toppled, true);
  forgetWorld('g1');
});

test('pulling a block clear of the footprint puts it in hand and the phase becomes place', () => {
  const grabbed = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  const out = dragUntil(grabbed, s => s.held === MIDDLE);
  assert.equal(out.blocks.length, 53);
  assert.equal(out.blocks.some(b => b.id === MIDDLE), false);
  assert.equal(out.phase, 'place');
  assert.equal(out.grab, null);
  assert.equal(out.toppled, false);
  assert.equal(out.gameStatus, 'Alice took a block out. Place it on top');
  assert.equal(refusal(out, 1, { type: 'grab', block: 19, anchor: END }), 'Place the block you are holding first');
  forgetWorld('g1');
});

test('the simulation stops once the tower is at rest after a release', () => {
  let state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  for (let tick = 0; tick < 10; tick++) state = simulate(act(state, 1, { type: 'drag', target: far(state, MIDDLE) }));
  state = act(state, 1, { type: 'release' });
  let ticks = 0;
  while (simulating(state) && ticks < 200) {
    state = simulate(state);
    ticks++;
  }
  assert.equal(simulating(state), false, `still moving after ${ticks} ticks`);
  assert.equal(state.sim, null);
  assert.ok(state.blocks.every(b => !b.v && !b.w));
  assert.equal(state.toppled, false);
  assert.equal(state.isGameOver, false);
  const moved = distance(block(state, MIDDLE).pose.p, block({ ...state, blocks: state.turnStart }, MIDDLE).pose.p);
  assert.ok(moved > 0.1 && moved < 7.5, `the block moved ${moved}`);
  forgetWorld('g1');
});

test('a topple ends the game once the collapse comes to rest', () => {
  const state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  // Taking away a low level's middle and one side leaves the tower on one edge
  let fallen = act({ ...state, blocks: state.blocks.filter(b => b.id !== 3 && b.id !== 4) }, 1, { type: 'release' });
  let ticks = 0;
  while (simulating(fallen) && ticks < 300) {
    fallen = simulate(fallen);
    ticks++;
  }
  assert.equal(fallen.toppled, true);
  assert.equal(fallen.loser, 1);
  assert.equal(fallen.isGameOver, true);
  assert.deepEqual(fallen.winners, [2]);
  assert.equal(fallen.currentPlayer, null);
  assert.deepEqual(fallen.lastMove, { type: 'topple', seat: 1 });
  assert.equal(fallen.gameStatus, 'Alice toppled the tower!');
  assert.equal(fallen.sim, null);
  forgetWorld('g1');
});

test('a world is rebuilt when the state did not come from the last tick', () => {
  let state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  state = simulate(act(state, 1, { type: 'drag', target: far(state, MIDDLE) }));
  // Copied blocks are never the ones the last tick returned, so both runs rebuild the world
  const copy = { ...state, blocks: [...state.blocks] };
  const first = simulate(copy);
  const second = simulate(copy);
  assert.deepEqual(second, first);
  assert.notEqual(second, first);
  forgetWorld('g1');
});

function place(state: GameState, seat: Seat, move: unknown): GameState {
  const result = jenga.applyMove(state, seat, move, () => 0.5, 0);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const placeRefusal = (state: GameState, seat: Seat, move: unknown) => {
  const result = jenga.applyMove(state, seat, move, () => 0.5, 0);
  return 'error' in result ? result.error : 'accepted';
};

// The tower at rest with `id` already taken out and in Alice's hand
function holding(id: number, state = lobby()): GameState {
  return { ...state, started: true, blocks: state.blocks.filter(b => b.id !== id), held: id, phase: 'place', pull: { seat: 1, block: id } };
}

function settle(state: GameState, limit = 300): GameState {
  for (let tick = 0; tick < limit && simulating(state); tick++) state = simulate(state);
  assert.equal(simulating(state), false, `still moving after ${limit} ticks`);
  return state;
}

const near = (a: number, b: number, within = 0.05) => Math.abs(a - b) < within;

test('place is refused without a block in hand, while the tower moves, and on a full slot', () => {
  assert.equal(placeRefusal(lobby(), 1, { type: 'place', slot: 0 }), 'You have no block to place');
  const moving = { ...holding(MIDDLE), sim: { ticks: 3, calmTicks: 0, sinceRelease: 3 } };
  assert.equal(placeRefusal(moving, 1, { type: 'place', slot: 0 }), 'Wait for the tower to settle');
  assert.equal(placeRefusal(holding(53), 1, { type: 'place', slot: 0 }), 'That spot is taken');
  assert.equal(placeRefusal({ ...holding(53), toppled: true, loser: 1 }, 1, { type: 'place', slot: 2 }), 'The tower has toppled');
  for (const bad of [{ type: 'place', slot: 3 }, { type: 'place', slot: '0' }, { type: 'place' }]) {
    assert.equal(placeRefusal(holding(53), 1, bad), 'Invalid slot', JSON.stringify(bad));
  }
  assert.equal(placeRefusal(holding(53), 1, { type: 'jump' }), 'Unknown move type');
});

test('placing fills the incomplete top level, else starts a new level at a quarter turn', () => {
  const filled = place(holding(53), 1, { type: 'place', slot: 2 });
  const top = block(filled, 53);
  assert.equal(top.level, 17);
  // The settled tower sags a few mm under its own weight, so heights are checked against the neighbors
  assert.ok(near(top.pose.p[0], 2.5) && near(top.pose.p[1], block(filled, 52).pose.p[1], 0.01) && near(top.pose.p[2], 0), String(top.pose.p));
  assert.equal(topLevel(filled.blocks), 17);

  const started = place(holding(MIDDLE), 1, { type: 'place', slot: 0 });
  const first = block(started, MIDDLE);
  assert.equal(first.level, 18);
  const below = block(started, 51).pose.p[1] + 1.5;
  assert.ok(near(first.pose.p[0], 0) && near(first.pose.p[1], below, 0.01) && near(first.pose.p[2], -2.5), String(first.pose.p));
  // Level 17 is turned a quarter, so level 18 runs along X again
  assert.ok(near(Math.abs(first.pose.q[3]), 1, 0.01), String(first.pose.q));
  assert.deepEqual(openSlots(started.blocks), [1, 2]);
});

test('a placement passes the turn, resets turnStart and records from and to', () => {
  const placed = place(holding(MIDDLE), 1, { type: 'place', slot: 1 });
  assert.equal(placed.currentPlayer, 2);
  assert.equal(placed.phase, 'pull');
  assert.equal(placed.held, null);
  assert.equal(placed.pull, null);
  assert.equal(placed.sim, null);
  assert.equal(placed.toppled, false);
  assert.equal(placed.placed[1], 1);
  assert.equal(placed.gameStatus, "Bob's turn to pull a block");
  assert.deepEqual(placed.turnStart, placed.blocks);
  assert.ok(placed.blocks.every(b => !b.v && !b.w));
  assert.deepEqual(placed.lastMove, {
    type: 'place', seat: 1, block: MIDDLE, level: 18, from: block(lobby(), MIDDLE).pose, to: block(placed, MIDDLE).pose
  });
});

test('a slid top block blocks the slot it moved into, and a top with no room left counts as full', () => {
  const state = lobby();
  // Block 52 (the middle of level 17, which runs along Z) slid 1.3 toward slot 2, where block 53 was taken
  const slid = state.blocks.filter(b => b.id !== 53).map(b => b.id === 52 ? { ...b, pose: { ...b.pose, p: [1.3, b.pose.p[1], 0] as Vec3 } } : b);
  assert.deepEqual(openSlots(slid), [0, 1, 2]);
  const placed = place({ ...holding(53), blocks: slid }, 1, { type: 'place', slot: 2 });
  assert.equal(block(placed, 53).level, 18);
  // Slid past the edge, a block still takes the nearest slot
  const far = state.blocks.filter(b => b.id !== 52 && b.id !== 53).map(b => b.id === 51 ? { ...b, pose: { ...b.pose, p: [-4, b.pose.p[1], 0] as Vec3 } } : b);
  assert.deepEqual(openSlots(far), [1, 2]);
});

test('a disconnect mid-pull drops the grab and the tower settles', () => {
  let state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  for (let tick = 0; tick < 5; tick++) state = simulate(act(state, 1, { type: 'drag', target: far(state, MIDDLE) }));
  const gone = disconnectPlayer(jenga, state, 1);
  assert.equal(gone.grab, null);
  assert.deepEqual(gone.pull, { seat: 1, block: MIDDLE });
  assert.equal(simulating(gone), true);
  assert.equal(gone.gameStatus, 'Alice disconnected');
  const settled = settle(gone);
  assert.equal(settled.toppled, false);
  assert.equal(settled.currentPlayer, 1);
  forgetWorld('g1');
});

test('a disconnect with a block in hand keeps it in hand', () => {
  const gone = disconnectPlayer(jenga, holding(MIDDLE), 1);
  assert.equal(gone.held, MIDDLE);
  assert.equal(gone.phase, 'place');
  assert.deepEqual(gone.disconnected, [1]);
});

test('a dismissal mid-turn puts the tower back as the turn started', () => {
  let state = act(lobby(() => 0.5, ['Alice', 'Bob', 'Cat']), 1, { type: 'grab', block: MIDDLE, anchor: END });
  for (let tick = 0; tick < 10; tick++) state = simulate(act(state, 1, { type: 'drag', target: far(state, MIDDLE) }));
  assert.notDeepEqual(state.blocks, state.turnStart);
  const left = removePlayer(jenga, disconnectPlayer(jenga, state, 1), 1);
  assert.deepEqual(left.blocks, left.turnStart);
  assert.equal(left.grab, null);
  assert.equal(left.pull, null);
  assert.equal(left.held, null);
  assert.equal(left.sim, null);
  assert.equal(left.currentPlayer, 2);
  // Bob's grab rebuilds the world from the turn start, not the dragged tower
  const next = simulate(act(left, 2, { type: 'grab', block: 19, anchor: END }));
  assert.ok(near(block(next, MIDDLE).pose.p[0], 0, 0.01), String(block(next, MIDDLE).pose.p));
  forgetWorld('g1');
});

test('a dismissal of someone not pulling leaves the tower as it is', () => {
  let state = act(lobby(() => 0.5, ['Alice', 'Bob', 'Cat']), 1, { type: 'grab', block: MIDDLE, anchor: END });
  state = simulate(act(state, 1, { type: 'drag', target: far(state, MIDDLE) }));
  const left = removePlayer(jenga, disconnectPlayer(jenga, state, 3), 3);
  assert.equal(left.blocks, state.blocks);
  assert.notEqual(left.grab, null);
  forgetWorld('g1');
});

test('onUndo always returns to the turn start with nobody holding a block', () => {
  let state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  for (let tick = 0; tick < 5; tick++) state = simulate(act(state, 1, { type: 'drag', target: far(state, MIDDLE) }));
  for (const restored of [state, { ...holding(MIDDLE), toppled: true, loser: 1 as Seat }]) {
    const undone = jenga.onUndo!(restored, () => 0.5);
    assert.deepEqual(undone.blocks, restored.turnStart);
    assert.equal(undone.blocks.length, 54);
    assert.equal(undone.phase, 'pull');
    assert.equal(undone.grab, null);
    assert.equal(undone.held, null);
    assert.equal(undone.pull, null);
    assert.equal(undone.sim, null);
    assert.equal(undone.toppled, false);
    assert.equal(undone.loser, null);
  }
});

test('resumeClock clears a grab and keeps settling', () => {
  let state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  for (let tick = 0; tick < 5; tick++) state = simulate(act(state, 1, { type: 'drag', target: far(state, MIDDLE) }));
  const resumed = jenga.resumeClock!(state, 0);
  assert.equal(resumed.grab, null);
  assert.equal(simulating(resumed), true);
  assert.equal(settle(resumed).toppled, false);
  const idle = lobby();
  assert.equal(jenga.resumeClock!(idle, 0), idle);
  forgetWorld('g1');
});

test('a tick that throws is logged, forgets the world and stops the simulation where the tower stood', (t: TestContext) => {
  const logged = t.mock.method(console, 'error', () => {});
  let state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  state = simulate(act(state, 1, { type: 'drag', target: far(state, MIDDLE) }));
  // A broken turnStart throws in the topple check, after the kept world has stepped
  const stopped = simulate({ ...state, turnStart: null as unknown as Block[] });
  assert.equal(logged.mock.callCount(), 1);
  assert.equal(stopped.sim, null);
  assert.equal(stopped.grab, null);
  assert.deepEqual(stopped.pull, { seat: 1, block: MIDDLE });
  const after = simulate(state);
  const rebuilt = simulate({ ...state, blocks: [...state.blocks] });
  assert.deepEqual(after, rebuilt);
  forgetWorld('g1');
});

test('a collapse after everyone else left does not change the winner', () => {
  const state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  const fallen = { ...state, blocks: state.blocks.filter(b => b.id !== 3 && b.id !== 4), grab: null };
  const over = settle(removePlayer(jenga, disconnectPlayer(jenga, fallen, 2), 2));
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [1]);
  assert.equal(over.toppled, false);
  forgetWorld('g1');
});

// Alice's last pulled block already lies on the ground outside the footprint while her tower collapses
function collapsing(names = ['Alice', 'Bob']): GameState {
  const state = act(lobby(() => 0.5, names), 1, { type: 'grab', block: MIDDLE, anchor: END });
  const blocks = state.blocks.map(b => b.id === MIDDLE ? { ...b, pose: { p: [10, 0.75, 0] as Vec3, q: [0, 0, 0, 1] as Block['pose']['q'] } } : b);
  return { ...state, blocks, grab: null, toppled: true, loser: 1, sim: { ticks: 0, calmTicks: 0, sinceRelease: 0 } };
}

test('a block lying outside during a collapse stays on the table and nobody holds it', () => {
  const over = settle(collapsing());
  assert.equal(over.isGameOver, true);
  assert.equal(over.blocks.length, 54);
  assert.equal(over.held, null);
  assert.equal(over.phase, 'pull');
  forgetWorld('g1');
});

test('dismissing the toppler during the collapse keeps the loss', () => {
  const left = removePlayer(jenga, disconnectPlayer(jenga, collapsing(['Alice', 'Bob', 'Cat']), 1), 1);
  assert.equal(left.toppled, true);
  assert.equal(left.loser, 1);
  const over = settle(left);
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [2, 3]);
  assert.deepEqual(over.lastMove, { type: 'topple', seat: 1 });
  forgetWorld('g1');
});

test('a collapse whose tick throws still ends the game against the toppler', (t: TestContext) => {
  t.mock.method(console, 'error', () => {});
  const state = collapsing();
  // A block with no rotation cannot be built into a world
  const broken = { ...state, blocks: [...state.blocks, { id: 99, level: 0, pose: { p: [0, 0, 0] as Vec3, q: null as unknown as Quat } }] };
  const over = simulate(broken);
  assert.equal(over.sim, null);
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [2]);
  assert.deepEqual(over.lastMove, { type: 'topple', seat: 1 });
});

// Alice's placement at rest and Bob to pull, but the tower still moving, as when settling hit its cap
function settling(): GameState {
  return { ...place(holding(MIDDLE), 1, { type: 'place', slot: 1 }), sim: { ticks: 0, calmTicks: 0, sinceRelease: 0 } };
}

// turnStart with block 0 a level higher, so the next topple check sees it fallen
const raised = (blocks: Block[]) => blocks.map(b => b.id === 0 ? { ...b, pose: { ...b.pose, p: [b.pose.p[0], b.pose.p[1] + 1.5, b.pose.p[2]] as Vec3 } } : b);

test('a grab is refused while the tower settles after a placement', () => {
  assert.equal(refusal(settling(), 2, { type: 'grab', block: 19, anchor: END }), 'Wait for the tower to settle');
});

test('a placement whose collapse finishes in later ticks blames the placer', () => {
  const state = settling();
  const fallen = simulate({ ...state, turnStart: raised(state.turnStart) });
  assert.equal(fallen.toppled, true);
  assert.equal(fallen.loser, 1);
  assert.equal(fallen.gameStatus, 'Alice toppled the tower!');
  const over = settle(fallen);
  assert.deepEqual(over.winners, [2]);
  assert.deepEqual(over.lastMove, { type: 'topple', seat: 1 });
  forgetWorld('g1');
});

test('a placement that settles in later ticks makes the rested tower the turn start', () => {
  const state = settling();
  const rested = settle({ ...state, turnStart: state.blocks.map(b => ({ ...b, v: [0, 0, 0] as Vec3 })) });
  assert.equal(rested.toppled, false);
  assert.deepEqual(rested.turnStart, rested.blocks);
  forgetWorld('g1');
});

test('a tick that topples and pulls the block clear at once keeps every block on the table', () => {
  const state = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  const blocks = state.blocks.map(b => b.id === MIDDLE ? { ...b, pose: { ...b.pose, p: [10, b.pose.p[1], 0] as Vec3 } } : b);
  const next = simulate({ ...state, blocks, turnStart: raised(state.turnStart) });
  assert.equal(next.toppled, true);
  assert.equal(next.held, null);
  assert.equal(next.blocks.length, 54);
  forgetWorld('g1');
});

test('the puller may let go during a vote, and nothing else', () => {
  const grabbed = act(lobby(), 1, { type: 'grab', block: MIDDLE, anchor: END });
  for (const vote of [{ undoVote: { requestedBy: 2, votes: { 2: true } } }, { dismissVote: { target: 2, requestedBy: 1, votes: { 1: true } } }]) {
    const voting = { ...grabbed, ...vote };
    assert.equal(refusal(voting, 2, { type: 'release' }), 'Not your turn');
    assert.equal(act(voting, 1, { type: 'release' }).grab, null);
    assert.notEqual(refusal(voting, 1, { type: 'drag', target: [0, 0, 0] }), 'accepted');
  }
});

test('standings put the toppler last and everyone else first with blocks placed', () => {
  const over: GameState = {
    ...lobby(() => 0.5, ['Alice', 'Bob', 'Cat']), isGameOver: true, toppled: true, loser: 1, winners: [2, 3], placed: { 1: 2, 2: 1, 3: 0 }
  };
  assert.deepEqual(jengaStandings(over), [
    { seat: 1, place: 2, score: 'Toppled the tower' }, { seat: 2, place: 1, score: '1 block placed' }, { seat: 3, place: 1, score: '0 blocks placed' }
  ]);
});

const turn = (speed: unknown) => ({ type: 'turn', speed });

// Every block, the turn start and the turntable carried round by `table`, as if the tower had been turned there
function turnedBy(state: GameState, table: Quat): GameState {
  const carry = (blocks: Block[]) => blocks.map(b => ({ ...b, pose: fromTable(b.pose, table) }));
  return { ...state, blocks: carry(state.blocks), turnStart: carry(state.turnStart), turntable: { q: table, w: 0, drive: null }, turnStartTurntable: table };
}

const nearPose = (a: Pose, b: Pose, within = 1e-9) => [...a.p, ...a.q].every((v, i) => Math.abs(v - [...b.p, ...b.q][i]) < within);

test('turning the turntable starts the simulation and only the current player may turn', () => {
  const state = lobby();
  const turning = act(state, 1, turn(2));
  assert.equal(turntableOf(turning).drive, 2);
  assert.notEqual(turning.sim, null);
  assert.equal(turning.started, true);
  assert.deepEqual(turning.pull, { seat: 1, block: null });
  assert.equal(refusal(state, 2, turn(2)), 'Not your turn');
});

test('a turn speed is checked and clamped', () => {
  const state = lobby();
  for (const speed of [NaN, Infinity, -Infinity, 'fast', undefined, '2']) assert.equal(refusal(state, 1, turn(speed)), 'Invalid speed', String(speed));
  assert.equal(turntableOf(act(state, 1, turn(1000))).drive, MAX_SPIN);
  assert.equal(turntableOf(act(state, 1, turn(-1000))).drive, -MAX_SPIN);
});

test('letting go of the turntable is allowed during a vote and nothing else is', () => {
  const turning = act(lobby(), 1, turn(2));
  const voting = { ...turning, undoVote: { requestedBy: 2 as Seat, votes: { 2: true } } };
  assert.equal(refusal(voting, 1, turn(2)), 'An undo vote is in progress');
  assert.equal(turntableOf(act(voting, 1, turn(null))).drive, null);
  const dismissing = { ...turning, dismissVote: { target: 2 as Seat, requestedBy: 1 as Seat, votes: { 1: true } } };
  assert.equal(refusal(dismissing, 1, turn(2)), 'A dismiss vote is in progress');
  assert.equal(turntableOf(act(dismissing, 1, turn(null))).drive, null);
  // A stray key-up with nothing driven changes nothing
  const idle = lobby();
  assert.equal(act(idle, 1, turn(null)), idle);
});

test('a turn waits for the last placement to settle', () => {
  assert.equal(refusal(settling(), 2, turn(1)), 'Wait for the tower to settle');
});

test('a grab is refused while the turntable still spins into the next turn', () => {
  const spinning = { ...lobby(), started: true, sim: { ticks: 3, calmTicks: 0, sinceRelease: 3 }, pull: null, turntable: { q: IDENTITY, w: 2, drive: null } };
  assert.equal(refusal(spinning, 1, { type: 'grab', block: MIDDLE, anchor: END }), 'Wait for the tower to settle');
  assert.equal(refusal({ ...spinning, pull: { seat: 1 as Seat, block: null } }, 1, { type: 'grab', block: MIDDLE, anchor: END }), 'accepted');
});

test('the simulation stops only once the turntable has coasted to a stop', () => {
  // A gentle spin held long enough that the tower rides it at rest, so only the spin itself keeps the simulation going
  let state = act(lobby(), 1, turn(1));
  for (let tick = 0; tick < 40; tick++) state = simulate(state);
  state = act(state, 1, turn(null));
  // atRest zeroes the spin, so the table must have reached 0 on its own and then stayed calm for CALM_TICKS (10) ticks,
  // the tick it stopped on being the first of them
  let stoppedAt: number | null = null;
  let tick = 0;
  for (; tick < 300 && simulating(state); tick++) {
    state = simulate(state);
    if (simulating(state) && turntableOf(state).w === 0) stoppedAt ??= tick;
  }
  assert.equal(simulating(state), false);
  assert.notEqual(stoppedAt, null, 'the simulation ended while the turntable still spun');
  assert.ok(tick - 1 - stoppedAt! >= 9, `ended ${tick - 1 - stoppedAt!} ticks after the table stopped`);
  assert.equal(turntableOf(state).w, 0);
  assert.equal(turntableOf(state).drive, null);
  assert.equal(state.sim, null);
  assert.notDeepEqual(turntableOf(state).q, IDENTITY);
  assert.equal(state.toppled, false);
  forgetWorld('g1');
});

test('a turn before any grab that topples the tower is the turner\'s loss', () => {
  let state = lobby();
  for (let tick = 0; tick < 400 && !state.toppled; tick++) {
    if (tick % 10 === 0) state = act(state, 1, turn(Math.floor(tick / 10) % 2 === 0 ? MAX_SPIN : -MAX_SPIN));
    state = simulate(state);
  }
  assert.equal(state.toppled, true);
  assert.equal(state.loser, 1);
  const over = settle(state, 700);
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.lastMove, { type: 'topple', seat: 1 });
  forgetWorld('g1');
});

test('slots and the footprint follow the turned tower', () => {
  const plain = holding(53);
  const turned = turnedBy(plain, QUARTER_TURN);
  assert.deepEqual(openSlots(turned.blocks, QUARTER_TURN), openSlots(plain.blocks));
  const plainTargets = placementTargets(plain.blocks, IDENTITY);
  const turnedTargets = placementTargets(turned.blocks, QUARTER_TURN);
  assert.deepEqual(turnedTargets.map(t => t.slot), plainTargets.map(t => t.slot));
  turnedTargets.forEach((t, i) => assert.ok(nearPose(t.pose, fromTable(plainTargets[i].pose, QUARTER_TURN)), `slot ${t.slot}`));
  assert.deepEqual(openSlots(turnedBy(holding(MIDDLE), QUARTER_TURN).blocks, QUARTER_TURN), [0, 1, 2]);
  // A place on a turned tower lands where its target said, and a pull out still takes the block out
  const placed = place(turned, 1, { type: 'place', slot: 2 });
  assert.equal(placed.toppled, false);
  // The settled tower sags a few mm, so only the spot on the top is compared
  const [at, aim] = [block(placed, 53).pose.p, turnedTargets.find(t => t.slot === 2)!.pose.p];
  assert.ok(near(at[0], aim[0]) && near(at[2], aim[2]), String(at));
  assert.deepEqual(placed.turnStartTurntable, QUARTER_TURN);
  const grabbed = act(turnedBy(lobby(), QUARTER_TURN), 1, { type: 'grab', block: MIDDLE, anchor: END });
  const out = dragUntil(grabbed, s => s.held === MIDDLE);
  assert.equal(out.toppled, false);
  assert.equal(out.phase, 'place');
  forgetWorld('g1');
});

test('undo and a dismissal put the turntable back to its turn-start angle', () => {
  const eighth: Quat = [0, 0.3826834323650898, 0, 0.9238795325112867];
  let state = act(turnedBy(lobby(), eighth), 1, turn(2));
  for (let tick = 0; tick < 5; tick++) state = simulate(state);
  assert.notDeepEqual(turntableOf(state).q, eighth);
  for (const back of [onUndo(state), onPlayerLeft(state, 1)]) {
    assert.deepEqual(back.turntable, { q: eighth, w: 0, drive: null });
    assert.deepEqual(back.blocks, state.turnStart);
  }
  forgetWorld('g1');
});

test('a disconnect lets go of the turntable', () => {
  const state = simulate(act(lobby(), 1, turn(2)));
  const gone = onPlayerDisconnected(state, 1);
  assert.equal(turntableOf(gone).drive, null);
  assert.equal(simulating(gone), true);
  assert.equal(onPlayerDisconnected(state, 2), state);
  assert.equal(turntableOf(jenga.resumeClock!(state, 0)).drive, null);
  forgetWorld('g1');
});

test('a room saved before the turntable loads and plays', () => {
  const { turntable: _turntable, turnStartTurntable: _turnStartTurntable, ...saved } = lobby();
  assert.deepEqual(jenga.toPublicState(saved, false, 1).turntable, REST_TURNTABLE);
  let turning = act(saved, 1, turn(2));
  for (let tick = 0; tick < 3; tick++) turning = simulate(turning);
  assert.notDeepEqual(turntableOf(turning).q, IDENTITY);
  assert.deepEqual(onUndo(turning).turntable, REST_TURNTABLE);
  forgetWorld('g1');
  const out = dragUntil(act(saved, 1, { type: 'grab', block: MIDDLE, anchor: END }), s => s.held === MIDDLE);
  assert.equal(onUndo(out).blocks.length, 54);
  assert.deepEqual(onUndo(out).turntable, REST_TURNTABLE);
  const placed = place(settle(out), 1, { type: 'place', slot: 0 });
  assert.equal(placed.currentPlayer, 2);
  assert.equal(placed.toppled, false);
  forgetWorld('g1');
});

test('views carry the turntable rounded and never the turn-start angle', () => {
  const state = { ...act(lobby(), 1, turn(2)), turntable: { q: [0, 0.123456, 0, 0.99234567] as Quat, w: 1.23456, drive: 2 } };
  for (const viewer of [1, 2, null]) {
    const json = JSON.stringify(jenga.toPublicState(state, false, viewer));
    assert.ok(json.includes('"turntable"'));
    assert.equal(json.includes('turnStartTurntable'), false);
  }
  assert.deepEqual(jenga.toPublicState(state, false, 1).turntable, { q: [0, 0.1235, 0, 0.9923], w: 1.235, drive: 2 });
});
