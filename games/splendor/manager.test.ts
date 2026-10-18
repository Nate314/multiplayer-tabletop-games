import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { rememberingKeys } from '../../server/testing.ts';
import { CARDS, GEMS, LEVELS } from './cards.ts';
import { TOKENS, payment, prestige, takeThreeCount, tokenTotal } from './rules.ts';
import { splendor } from './index.ts';
import type { Move, PublicGameState, Token, Tokens } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'splendor/g1';

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
  const manager = rememberingKeys(createGameManager([splendor], seeded(1)));
  for (const name of names) manager.join('splendor', 'g1', name);
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

// A legal move from the mover's own view: finish a pending step, else buy the dearest affordable card,
// else take gems, else reserve, else pass
function anyMove(view: PublicGameState, seat: number): Move {
  const player = view.players[seat];
  if (view.pending?.kind === 'returnTokens') {
    const tokens: Partial<Tokens> = {};
    let left = view.pending.count;
    for (const token of [...TOKENS].sort((a: Token, b: Token) => player.tokens[b] - player.tokens[a])) {
      const give = Math.min(left, player.tokens[token]);
      if (give > 0) tokens[token] = give;
      left -= give;
    }
    return { type: 'returnTokens', tokens };
  }
  if (view.pending?.kind === 'chooseNoble') return { type: 'chooseNoble', noble: view.pending.nobles[0] };

  const own = player.reserved.flatMap((held, index) => (held.card !== null && payment(player, CARDS[held.card]) ? [index] : []));
  if (own.length > 0) return { type: 'buy', source: { kind: 'reserved', index: own[0] } };
  for (const level of [...LEVELS].reverse()) {
    const slot = view.market[level].findIndex(id => id !== null && payment(player, CARDS[id]) !== null);
    if (slot >= 0) return { type: 'buy', source: { kind: 'market', level, slot } };
  }
  const count = takeThreeCount(view.supply);
  if (count === 3) {
    const colors = [...GEMS].sort((a, b) => view.supply[b] - view.supply[a]).slice(0, 3);
    return { type: 'takeThree', colors };
  }
  const two = GEMS.find(gem => view.supply[gem] >= 4);
  if (two) return { type: 'takeTwo', color: two };
  if (count > 0) return { type: 'takeThree', colors: GEMS.filter(gem => view.supply[gem] > 0) };
  if (player.reserved.length < 3) {
    const level = LEVELS.find(candidate => view.deckCounts[candidate] > 0);
    if (level) return { type: 'reserve', source: { kind: 'deck', level } };
    for (const candidate of LEVELS) {
      const slot = view.market[candidate].findIndex(id => id !== null);
      if (slot >= 0) return { type: 'reserve', source: { kind: 'market', level: candidate, slot } };
    }
  }
  return { type: 'pass' };
}

function step(manager: Manager): PublicGameState {
  const seat = viewOf(manager, null).currentPlayer ?? assert.fail('nobody to move');
  return ok(manager.move(ROOM, seat, anyMove(viewOf(manager, seat), seat)));
}

test('a whole game played with legal moves ends after someone reaches 15, with equal turns', () => {
  const manager = gameWith('A', 'B', 'C');
  let state = viewOf(manager, null);
  const turns: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (let moves = 0; !state.isGameOver && moves < 2000; moves++) {
    const seat = state.currentPlayer ?? assert.fail('nobody to move');
    state = step(manager);
    if (state.currentPlayer !== seat) turns[seat]++; // a turn is over once play leaves the seat
    for (const key of [1, 2, 3]) assert.ok(tokenTotal(state.players[key].tokens) <= 10 || state.pending?.kind === 'returnTokens');
  }
  assert.equal(state.isGameOver, true);
  assert.ok(Object.values(state.players).some(player => prestige(player) >= 15));
  assert.deepEqual(new Set(Object.values(turns)).size, 1, `turns: ${JSON.stringify(turns)}`);
  const top = Math.max(...[1, 2, 3].map(seat => prestige(state.players[seat])));
  assert.ok(state.winners.every(seat => prestige(state.players[seat]) === top));
});

test('a rejoin mid-turn shows the same unfinished token return', () => {
  const manager = gameWith('A', 'B');
  let state = viewOf(manager, null);
  // A takes gems and B reserves from a deck, until A holds more than 10
  for (let moves = 0; state.pending?.kind !== 'returnTokens' && moves < 50; moves++) {
    const colors = [...GEMS].sort((a, b) => state.supply[b] - state.supply[a]).slice(0, 3);
    const next: Move = state.currentPlayer === 1
      ? { type: 'takeThree', colors }
      : { type: 'reserve', source: { kind: 'deck', level: 1 } };
    state = ok(manager.move(ROOM, state.currentPlayer ?? assert.fail('nobody to move'), next));
  }
  const seat = state.currentPlayer ?? assert.fail('nobody to move');
  assert.equal(state.pending?.kind, 'returnTokens');
  const before = viewOf(manager, seat);

  manager.disconnect(ROOM, seat);
  const rejoined = manager.join('splendor', 'g1', seat === 1 ? 'A' : 'B', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.equal(rejoined.seat, seat);
  assert.deepEqual(view.pending, before.pending);
  assert.deepEqual(view.players[seat], before.players[seat]);
  assert.equal(view.currentPlayer, seat);
  assert.deepEqual(manager.move(ROOM, seat, { type: 'takeTwo', color: 'red' }), { error: 'Return tokens down to 10 first' });
  const done = ok(manager.move(ROOM, seat, anyMove(view, seat)));
  assert.equal(done.pending?.kind === 'returnTokens', false);
});

test('the history and every other seat never see a card reserved from a deck', () => {
  const manager = gameWith('A', 'B');
  ok(manager.move(ROOM, 1, { type: 'reserve', source: { kind: 'deck', level: 3 } }));
  const mine = viewOf(manager, 1).players[1].reserved[0];
  assert.notEqual(mine.card, null);
  assert.deepEqual(viewOf(manager, 2).players[1].reserved, [{ level: 3, card: null }]);
  for (const past of manager.history('splendor', 'g1') as unknown as PublicGameState[]) {
    assert.equal('decks' in past, false);
    for (const player of Object.values(past.players)) assert.ok(player.reserved.every(held => held.card === null));
  }
});

test('undo puts a bought card back on the table', () => {
  const manager = gameWith('A', 'B');
  let state = viewOf(manager, null);
  for (let moves = 0; state.lastMove?.type !== 'buy' && moves < 500; moves++) state = step(manager);
  const buyer = state.lastMove?.seat ?? assert.fail('nobody bought');
  const count = state.players[buyer].cards.length;
  ok(manager.requestUndo(ROOM, buyer));
  const restored = ok(manager.voteUndo(ROOM, buyer === 1 ? 2 : 1, true));
  assert.equal(restored.players[buyer].cards.length, count - 1);
  assert.equal(restored.currentPlayer, buyer);
});

test('an undo past a dismissed player\'s token return does not hand their step to the next player', () => {
  const manager = gameWith('A', 'B', 'C');
  let state = viewOf(manager, null);
  // A takes gems and the others reserve from a deck, until A must give tokens back
  for (let moves = 0; state.pending?.kind !== 'returnTokens' && moves < 60; moves++) {
    const seat = state.currentPlayer ?? assert.fail('nobody to move');
    const colors = [...GEMS].sort((a, b) => state.supply[b] - state.supply[a]).slice(0, 3);
    const next: Move = seat === 1 ? { type: 'takeThree', colors } : { type: 'reserve', source: { kind: 'deck', level: 1 } };
    state = ok(manager.move(ROOM, seat, next));
  }
  assert.equal(state.currentPlayer, 1);
  ok(manager.move(ROOM, 1, anyMove(viewOf(manager, 1), 1)));

  // A is dismissed during B's turn, then B and C undo A's token return
  manager.disconnect(ROOM, 1);
  ok(manager.requestDismiss(ROOM, 2, 1));
  ok(manager.voteDismiss(ROOM, 3, true));
  ok(manager.requestUndo(ROOM, 2));
  const restored = ok(manager.voteUndo(ROOM, 3, true));

  assert.deepEqual(restored.activePlayers, [2, 3]);
  assert.equal(restored.pending, null);
  assert.equal(restored.currentPlayer, 2);
  assert.equal(tokenTotal(restored.players[1].tokens), 0);
  const held = [2, 3].reduce((total, seat) => total + tokenTotal(restored.players[seat].tokens), 0);
  assert.equal(tokenTotal(restored.supply) + held, 5 * 5 + 5);
  const moved = ok(manager.move(ROOM, 2, anyMove(viewOf(manager, 2), 2)));
  assert.equal(moved.pending?.kind === 'returnTokens' || moved.currentPlayer === 3, true);
});

test('dismissing the last opponent hands the win to the player left', () => {
  const manager = gameWith('A', 'B');
  step(manager);
  manager.disconnect(ROOM, 2);
  const state = ok(manager.requestDismiss(ROOM, 1, 2));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});
