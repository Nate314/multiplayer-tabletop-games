import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { canPlayCard, trueTokens } from './rules.ts';
import { thecrew } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'thecrew/g1';
const NAMES = ['A', 'B', 'C', 'D'];

function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gameWith(...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([thecrew], seeded(1)));
  for (const name of names) manager.join('thecrew', 'g1', name);
  return manager;
}

function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// A legal move from the current player's own view: the first open task, else the first legal card
function anyMove(view: PublicGameState, seat: number): Move {
  if (view.phase === 'choose') return { type: 'takeTask', task: view.tasks.findIndex(t => t.owner === null) };
  const card = view.hand.find(held => canPlayCard(view.hand, held, view.trick)) ?? assert.fail(`seat ${seat} has nothing to play`);
  return { type: 'play', card };
}

function step(manager: Manager): PublicGameState {
  const state = viewOf(manager, null);
  if (state.roundSummary) {
    for (const seat of state.activePlayers) ok(manager.action(ROOM, seat, { type: 'acknowledgeRound' }));
    return viewOf(manager, null);
  }
  const seat = state.currentPlayer ?? assert.fail('nobody to move');
  return ok(manager.move(ROOM, seat, anyMove(viewOf(manager, seat), seat)));
}

test('moves wait for three players, and joining closes after the first move', () => {
  const manager = gameWith('A', 'B');
  assert.deepEqual(manager.move(ROOM, 1, { type: 'takeTask', task: 0 }), { error: 'Waiting for more players' });
  assert.equal(viewOf(manager, 1).hand.length, 0);
  ok(manager.action(ROOM, 1, { type: 'chooseMission', mission: 3 }));
  manager.join('thecrew', 'g1', 'C');
  const view = viewOf(manager, 1);
  assert.equal(view.mission, 3);
  assert.ok(view.hand.length >= 13);
  step(manager);
  assert.equal('error' in manager.join('thecrew', 'g1', 'D'), true);
  assert.ok('error' in manager.action(ROOM, 1, { type: 'chooseMission', mission: 4 }));
});

test('a short game: each player sees only their own hand, the table sees none', () => {
  const manager = gameWith(...NAMES);
  // The task, then two tricks
  for (let i = 0; i < 1 + 8; i++) step(manager);
  const views = [1, 2, 3, 4].map(seat => viewOf(manager, seat));
  views.forEach((view, index) => assert.equal(view.hand.length, view.handCounts[index + 1]));
  assert.notDeepEqual(views[0].hand, views[1].hand);

  const history = manager.history('thecrew', 'g1') as unknown as PublicGameState[];
  for (const state of [...history, viewOf(manager, null)]) {
    assert.deepEqual(state.hand, []);
    for (const key of ['hands', 'tricks']) assert.equal(key in state, false);
  }
});

test('a rejoin mid-turn shows the same half-finished trick, hand and communication', () => {
  const manager = gameWith(...NAMES);
  step(manager);
  // Someone communicates before the first trick, then two cards are played
  const commander = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const hand = viewOf(manager, commander).hand;
  const card = hand.find(held => held.suit !== 'rocket' && !hand.some(other => other.suit === held.suit && other.value > held.value))
    ?? assert.fail('no card to communicate');
  ok(manager.action(ROOM, commander, { type: 'communicate', card, token: trueTokens(hand, card)[0] }));
  step(manager);
  step(manager);
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const before = viewOf(manager, seat);
  assert.equal(before.trick.length, 2);
  manager.disconnect(ROOM, seat);
  assert.deepEqual(viewOf(manager, null).disconnected, [seat]);
  const back = manager.join('thecrew', 'g1', NAMES[seat - 1], true);
  if ('error' in back) assert.fail(back.error);
  const after = back.state as PublicGameState;
  assert.deepEqual(after.hand, before.hand);
  assert.deepEqual(after.trick, before.trick);
  assert.deepEqual(after.communications, before.communications);
  assert.equal(after.currentPlayer, seat);
  ok(manager.move(ROOM, seat, anyMove(after, seat)));
});

test('undo takes a task back', () => {
  const manager = gameWith(...NAMES);
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  ok(manager.move(ROOM, seat, { type: 'takeTask', task: 0 }));
  ok(manager.requestUndo(ROOM, seat));
  for (const other of [1, 2, 3, 4].filter(s => s !== seat)) manager.voteUndo(ROOM, other, true);
  const restored = viewOf(manager, null);
  assert.equal(restored.currentPlayer, seat);
  assert.equal(restored.tasks[0].owner, null);
});

test('missions follow one another, and the end vote ends the game with a game file', () => {
  const manager = gameWith(...NAMES);
  let state = viewOf(manager, null);
  // Plays on until two missions are done; failures retry the same mission
  for (let moves = 0; (state.lastCompleted ?? 0) < 2 && moves < 5000; moves++) state = step(manager);
  assert.equal(state.lastCompleted, 2);
  assert.equal(state.phase, 'missionOver');
  for (const seat of [1, 2, 3, 4]) ok(manager.action(ROOM, seat, { type: 'voteEnd', yes: true }));
  state = viewOf(manager, null);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1, 2, 3, 4]);
  assert.equal(state.gameStatus, 'The crew ended the game. Last mission completed: 2');
  const file = manager.gameFile('thecrew', 'g1', new Date());
  assert.ok(file && 'file' in file);
});

test('dismissing a player mid-game ends it', () => {
  const manager = gameWith(...NAMES);
  step(manager);
  manager.disconnect(ROOM, 2);
  ok(manager.requestDismiss(ROOM, 1, 2));
  ok(manager.voteDismiss(ROOM, 3, true));
  const state = ok(manager.voteDismiss(ROOM, 4, true));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1, 3, 4]);
});
