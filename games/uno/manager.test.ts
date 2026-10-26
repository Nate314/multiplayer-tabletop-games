import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { agreeAll, rememberingKeys, stepsOf } from '../../server/testing.ts';
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
  return gameWithRules({}, ...names);
}

function gameWithRules(values: Record<string, boolean>, ...names: string[]): Manager {
  const manager = rememberingKeys(createGameManager([uno], seeded(1)));
  for (const name of names) manager.join('uno', 'g1', name);
  if (Object.keys(values).length > 0) ok(manager.setHouseRules(ROOM, 1, { values, maxPlayers: null }));
  agreeAll(manager, ROOM);
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

// A legal move for the current player, from their own view: name a color after a starting Wild, accept a
// Wild Draw Four, else play the card just drawn or the first card that matches (calling UNO), else draw.
// A Wild always asks for red.
function anyMove(view: PublicGameState): Move {
  const { hand, discardTop, currentColor, drawnCard, pendingFour, pendingDraw } = view;
  if (currentColor === null) return { type: 'chooseColor', color: 'red' };
  if (pendingDraw) {
    const stack = hand.find(held => held.value === 'wildDrawFour' || (held.value === 'drawTwo' && discardTop?.value === 'drawTwo'));
    return stack ? { type: 'play', card: stack, color: 'red' } : { type: 'accept' };
  }
  if (pendingFour) return { type: 'accept' };
  const card = drawnCard ?? hand.find(held => canPlay(held, discardTop, currentColor));
  const swapWith = view.activePlayers.find(seat => seat !== view.currentPlayer);
  if (card) return { type: 'play', card, color: 'red', uno: true, swapWith };
  return { type: 'draw' };
}

// After a round everyone continues. When every card is in a hand there is nothing to draw, and the player passes instead.
function step(manager: Manager): PublicGameState {
  const state = viewOf(manager, null);
  if (state.roundSummary) {
    for (const seat of state.activePlayers) ok(manager.action(ROOM, seat, { type: 'acknowledgeRound' }));
    return viewOf(manager, null);
  }
  const seat = state.currentPlayer;
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

  const history = (stepsOf(manager, 'uno') as unknown as PublicGameState[]);
  assert.equal(history.length, 7);
  for (const state of [...history, viewOf(manager, null)]) {
    assert.deepEqual(state.hand, []);
    assert.equal(state.drawnCard, null);
  }
});

test('the joining player gets their own hand straight away', () => {
  const manager = rememberingKeys(createGameManager([uno], seeded(2)));
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

test('a whole game played with legal moves ends when someone reaches 500 points', () => {
  const manager = gameWith('A', 'B', 'C', 'D');
  let state = viewOf(manager, null);
  for (let moves = 0; !state.isGameOver && moves < 50000; moves++) {
    state = step(manager);
  }
  assert.equal(state.isGameOver, true);
  assert.equal(state.winners.length, 1);
  assert.equal(state.handCounts[state.winners[0]], 0);
  assert.ok(state.scores[state.winners[0]] >= 500);
  assert.ok(state.roundNumber > 1);
});

test('a challenged hand reaches the challenger\'s view only, never the others or the history', () => {
  const manager = gameWith('A', 'B', 'C');
  let state = viewOf(manager, null);
  for (let moves = 0; !state.pendingFour && moves < 5000; moves++) state = step(manager);
  const pending = state.pendingFour ?? assert.fail('no Wild Draw Four was played');
  const held = viewOf(manager, pending.by).hand;

  ok(manager.move(ROOM, pending.target, { type: 'challenge' }));
  assert.deepEqual(viewOf(manager, pending.target).revealed, { of: pending.by, hand: held });
  for (const seat of [1, 2, 3].filter(other => other !== pending.target)) assert.equal(viewOf(manager, seat).revealed, null);
  assert.equal(viewOf(manager, null).revealed, null);
  for (const past of (stepsOf(manager, 'uno') as unknown as PublicGameState[])) assert.equal(past.revealed, null);
});

test('a spectator allowed on the challenger never gets the challenged hand, live or in the game file', () => {
  const manager = gameWith('A', 'B', 'C');
  const dana = manager.join('uno', 'g1', 'Dana', false, undefined, 'spectator');
  if ('error' in dana || !dana.spectatorId) assert.fail('Dana could not watch');
  let state = viewOf(manager, null);
  for (let moves = 0; !state.pendingFour && moves < 5000; moves++) state = step(manager);
  const pending = state.pendingFour ?? assert.fail('no Wild Draw Four was played');
  ok(manager.requestHand(ROOM, dana.spectatorId, pending.target));
  ok(manager.answerHand(ROOM, pending.target, dana.spectatorId, true));

  ok(manager.move(ROOM, pending.target, { type: 'challenge' }));
  assert.notEqual(viewOf(manager, pending.target).revealed, null); // the challenger still sees it
  const seen = manager.getSpectatorState(ROOM, dana.spectatorId) as PublicGameState & { seatViews: Record<number, object> };
  assert.ok('hand' in seen.seatViews[pending.target]);
  assert.equal('revealed' in seen.seatViews[pending.target], false);

  for (let moves = 0; !state.isGameOver && moves < 50000; moves++) state = step(manager);
  const file = manager.gameFile('uno', 'g1', dana.seatKey, new Date(0));
  if (!('file' in file)) assert.fail(file.error);
  for (const { views } of file.file.steps) {
    assert.deepEqual(Object.keys(views ?? {}), [String(pending.target)]);
    assert.ok(!(views?.[pending.target] as Partial<PublicGameState>).revealed);
  }
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

test('a whole game with every house rule on still ends, and a stack is never left hanging', () => {
  const manager = gameWithRules({ stacking: true, sevenZero: true, drawUntilPlayable: true }, 'A', 'B', 'C');
  let state = viewOf(manager, null);
  let stacks = 0;
  for (let moves = 0; !state.isGameOver && moves < 50000; moves++) {
    state = step(manager);
    if (state.pendingDraw) {
      stacks++;
      assert.equal(state.pendingDraw.target, state.currentPlayer);
    }
  }
  assert.equal(state.isGameOver, true);
  assert.ok(stacks > 0);
  assert.equal(state.pendingDraw, null);
});

// Plays on until a player who does not hold the turn has the top card's twin
function untilJumpable(manager: Manager): { jumper: number; move: Move; view: PublicGameState } {
  for (let moves = 0; moves < 5000; moves++) {
    const view = viewOf(manager, null);
    const top = view.discardTop;
    if (top && /^[0-9]$/.test(top.value) && !view.pendingFour && !view.pendingDraw && !view.roundSummary && view.currentColor !== null) {
      for (const seat of view.activePlayers.filter(other => other !== view.currentPlayer)) {
        const card = viewOf(manager, seat).hand.find(held => held.color === top.color && held.value === top.value);
        if (card) return { jumper: seat, move: { type: 'play', card }, view };
      }
    }
    step(manager);
  }
  return assert.fail('nobody could jump in');
}

test('a jump-in can be undone', () => {
  const manager = gameWithRules({ jumpIn: true }, 'A', 'B', 'C');
  const { jumper, move, view } = untilJumpable(manager);
  const before = viewOf(manager, jumper);
  const jumped = ok(manager.move(ROOM, jumper, move, view.moveCount));
  assert.equal(jumped.handCounts[jumper], before.hand.length - 1);
  assert.equal(jumped.lastMove?.type === 'play' && jumped.lastMove.jumpedIn, true);

  ok(manager.requestUndo(ROOM, jumper));
  for (const seat of view.activePlayers.filter(other => other !== jumper)) ok(manager.voteUndo(ROOM, seat, true));
  const restored = viewOf(manager, jumper);
  assert.deepEqual(restored.hand, before.hand);
  assert.equal(restored.currentPlayer, view.currentPlayer);
  assert.deepEqual(restored.discardTop, view.discardTop);
});

test('the second of two jump-ins on the same card is refused', () => {
  const manager = gameWithRules({ jumpIn: true }, 'A', 'B', 'C');
  const { jumper, move, view } = untilJumpable(manager);
  ok(manager.move(ROOM, jumper, move, view.moveCount));
  const late = view.activePlayers.find(seat => seat !== jumper) ?? assert.fail('no other player');
  assert.deepEqual(manager.move(ROOM, late, move, view.moveCount), { error: 'Someone else moved first' });
});

test('a full game at 10 players', () => {
  const manager = rememberingKeys(createGameManager([uno], seeded(3)));
  manager.join('uno', 'g1', 'P1');
  ok(manager.setHouseRules(ROOM, 1, { values: {}, maxPlayers: 10 }));
  for (let seat = 2; seat <= 10; seat++) manager.join('uno', 'g1', `P${seat}`);
  agreeAll(manager, ROOM);
  let state = viewOf(manager, null);
  assert.equal(state.activePlayers.length, 10);
  for (let moves = 0; !state.isGameOver && moves < 100000; moves++) state = step(manager);
  assert.equal(state.isGameOver, true);
  assert.equal(state.winners.length, 1);
});
