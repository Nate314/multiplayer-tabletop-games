import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { canPlay } from './rules.ts';
import { uno } from './index.ts';
import type { Move, PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'uno/g1';

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
  const manager = createGameManager([uno], seeded(1));
  for (const name of names) manager.join('uno', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to UNO's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// A legal move for the current player, from their own view: the card just drawn, else the first card
// that matches, else draw (or pass once drawn). A Wild always asks for red.
function anyMove(view: PublicGameState): Move {
  const { hand, discardTop, currentColor, drawnCard } = view;
  const card = drawnCard ?? hand.find(held => canPlay(held, discardTop, currentColor));
  if (card) return { type: 'play', card, color: 'red' };
  return { type: 'draw' };
}

// When every card is in a hand there is nothing to draw, and the player passes instead
function step(manager: Manager): PublicGameState {
  const seat = viewOf(manager, null).currentPlayer;
  if (seat === null) assert.fail('nobody to move');
  const result = manager.move(ROOM, seat, anyMove(viewOf(manager, seat)));
  if ('error' in result && result.error === 'There are no cards left to draw') return ok(manager.move(ROOM, seat, { type: 'pass' }));
  return ok(result);
}

test('each player sees only their own hand, and the history sees none', () => {
  const manager = gameWith('A', 'B', 'C');
  for (let i = 0; i < 6; i++) step(manager);

  const views = [1, 2, 3].map(seat => viewOf(manager, seat));
  views.forEach((view, index) => {
    assert.equal(view.hand.length, view.handCounts[index + 1]);
    for (const key of ['hands', 'drawPile', 'discardPile', 'turnHolder']) assert.equal(key in view, false);
  });
  assert.notDeepEqual(views[0].hand, views[1].hand);

  const history = manager.history('uno', 'g1') as PublicGameState[];
  assert.equal(history.length, 6);
  for (const state of [...history, viewOf(manager, null)]) {
    assert.deepEqual(state.hand, []);
    assert.equal(state.drawnCard, null);
  }
});

test('the joining player gets their own hand straight away', () => {
  const manager = createGameManager([uno], seeded(2));
  manager.join('uno', 'g1', 'A');
  const joined = manager.join('uno', 'g1', 'B');
  if ('error' in joined) assert.fail(joined.error);
  const view = joined.state as PublicGameState;
  assert.equal(joined.seat, 2);
  assert.equal(view.hand.length, view.handCounts[2]);
  assert.equal(view.handCounts[1] >= 7, true);
});

test('moves are validated', () => {
  const manager = gameWith('A', 'B');
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const other = seat === 1 ? 2 : 1;
  assert.deepEqual(manager.move('nope', seat, { type: 'draw' }), { error: 'Game not found' });
  assert.deepEqual(manager.move(ROOM, 3, { type: 'draw' }), { error: 'You are not in this game' });
  assert.deepEqual(manager.move(ROOM, other, { type: 'draw' }), { error: 'Not your turn' });
  assert.deepEqual(manager.move(ROOM, seat, { type: 'shout' }), { error: 'Invalid move' });
  assert.deepEqual(manager.move(ROOM, seat, { type: 'pass' }), { error: 'Draw a card before passing' });

  const drawn = ok(manager.move(ROOM, seat, { type: 'draw' }));
  assert.equal(drawn.started, true);
  assert.equal(drawn.hand.length, drawn.handCounts[seat]);
});

test('undo restores the hand from before the move', () => {
  const manager = gameWith('A', 'B');
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  const before = viewOf(manager, seat);
  ok(manager.move(ROOM, seat, { type: 'draw' }));
  ok(manager.requestUndo(ROOM, seat));
  ok(manager.voteUndo(ROOM, seat === 1 ? 2 : 1, true));
  const restored = viewOf(manager, seat);
  assert.deepEqual(restored.hand, before.hand);
  assert.equal(restored.currentPlayer, seat);
  assert.equal(restored.hasDrawn, false);
});

test('a whole game played with legal moves ends with one winner', () => {
  const manager = gameWith('A', 'B', 'C', 'D');
  let state = viewOf(manager, null);
  for (let moves = 0; !state.isGameOver && moves < 2000; moves++) {
    state = step(manager);
  }
  assert.equal(state.isGameOver, true);
  assert.equal(state.winners.length, 1);
  assert.equal(state.handCounts[state.winners[0]], 0);
});

test('dismissing a player mid-game skips their seat', () => {
  const manager = gameWith('A', 'B', 'C');
  step(manager);
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  const state = ok(manager.voteDismiss(ROOM, 2, true));
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal('3' in state.handCounts, false);
  assert.notEqual(state.currentPlayer, 3);
});
