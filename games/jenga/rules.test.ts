import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jenga } from './index.ts';
import { applyAction, canPull, openSlots, simulate, simulating, topLevel } from './rules.ts';
import { forgetWorld } from './simulation.ts';
import { MAX_REACH, anchorWorld } from './physics.ts';
import { addPlayer } from '../../shared/seating.ts';
import type { Block, GameState, Seat, Vec3 } from './types.ts';

// Middle of level 7, which runs along Z; local +X is its long axis
const MIDDLE = 22;
const END: Vec3 = [3.75, 0, 0];

function lobby(random: () => number = () => 0.5): GameState {
  let state = jenga.createGameState('g1');
  for (const name of ['Alice', 'Bob']) {
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
