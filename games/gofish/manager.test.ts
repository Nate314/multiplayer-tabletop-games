import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { gofish } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'gofish/g1';

// The same deal on every run
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
  const manager = rememberingKeys(createGameManager([gofish], seeded(1)));
  for (const name of names) manager.join('gofish', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Go Fish's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// A legal ask from the current player's own view, with the rank and the player picked by `choose`
function anyMove(view: PublicGameState, choose: Random): Move {
  const seat = view.currentPlayer ?? assert.fail('nobody to move');
  const others = view.activePlayers.filter(other => other !== seat && view.handCounts[other] > 0);
  const target = others[Math.floor(choose() * others.length)];
  return { type: 'ask', target, rank: view.hand[Math.floor(choose() * view.hand.length)].rank };
}

function step(manager: Manager, choose: Random): PublicGameState {
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  return ok(manager.move(ROOM, seat, anyMove(viewOf(manager, seat), choose)));
}

test('a whole game ends with all 13 books, and the history and the game file hide every hand from the table', () => {
  const manager = gameWith('A', 'B', 'C', 'D');
  const choose = seeded(5);
  let state = viewOf(manager, null);
  for (let moves = 0; !state.isGameOver && moves < 5000; moves++) state = step(manager, choose);
  assert.equal(state.isGameOver, true);
  assert.equal(Object.values(state.books).flat().length, 13);
  const most = Math.max(...state.activePlayers.map(seat => state.books[seat].length));
  assert.deepEqual(state.winners, state.activePlayers.filter(seat => state.books[seat].length === most));

  const history = manager.history('gofish', 'g1') as unknown as PublicGameState[];
  assert.equal(history.length, state.moveCount + 1);
  for (const past of history) {
    assert.deepEqual(past.hand, []);
    if (past.lastMove?.fished !== 'asked') assert.equal(past.fishedCard, null);
  }

  const file = manager.gameFile('gofish', 'g1', new Date(0));
  if (!file || 'error' in file) assert.fail('expected a game file');
  const start = file.file.steps[0] as unknown as PublicGameState & { views: Record<string, PublicGameState> };
  assert.deepEqual(start.hand, []);
  for (const seat of [1, 2, 3, 4]) assert.equal(start.views[seat].hand.length, start.handCounts[seat]);
});

test('a rejoin mid-turn shows the same turn and hand', () => {
  const manager = gameWith('A', 'B');
  // Play until someone hits and is asking again
  const choose = seeded(3);
  let state = viewOf(manager, null);
  for (let moves = 0; !state.lastMove?.goesAgain && moves < 200; moves++) state = step(manager, choose);
  const seat = state.lastMove?.asker ?? assert.fail('nobody hit');
  const before = viewOf(manager, seat);

  manager.disconnect(ROOM, seat);
  assert.deepEqual(manager.move(ROOM, seat === 1 ? 2 : 1, { type: 'ask', target: seat, rank: 'A' }), { error: 'Not your turn' });
  const rejoined = manager.join('gofish', 'g1', seat === 1 ? 'A' : 'B', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.equal(view.currentPlayer, seat);
  assert.deepEqual(view.hand, before.hand);
  assert.deepEqual(view.log, before.log);
});

test('undo restores the hands from before the ask', () => {
  const manager = gameWith('A', 'B');
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const other = seat === 1 ? 2 : 1;
  const mine = viewOf(manager, seat).hand;
  const theirs = viewOf(manager, other).hand;
  ok(manager.move(ROOM, seat, { type: 'ask', target: other, rank: mine[0].rank }));
  ok(manager.requestUndo(ROOM, seat));
  ok(manager.voteUndo(ROOM, other, true));
  assert.deepEqual(viewOf(manager, seat).hand, mine);
  assert.deepEqual(viewOf(manager, other).hand, theirs);
  assert.equal(viewOf(manager, null).currentPlayer, seat);
  assert.deepEqual(viewOf(manager, null).log, []);
});

test('dismissing the player whose turn it is moves the game on', () => {
  const manager = gameWith('A', 'B', 'C');
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const first = viewOf(manager, null);
  const other = first.activePlayers.find(s => s !== seat) ?? assert.fail('nobody else');
  ok(manager.move(ROOM, seat, { type: 'ask', target: other, rank: viewOf(manager, seat).hand[0].rank }));
  const holder = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  manager.disconnect(ROOM, holder);
  const voters = viewOf(manager, null).activePlayers.filter(s => s !== holder);
  ok(manager.requestDismiss(ROOM, voters[0], holder));
  const state = ok(manager.voteDismiss(ROOM, voters[1], true));
  assert.equal(state.activePlayers.includes(holder), false);
  assert.ok(state.currentPlayer !== null && state.activePlayers.includes(state.currentPlayer));
  assert.ok(state.handCounts[state.currentPlayer] > 0);
  assert.equal(holder in state.handCounts, false);
});
