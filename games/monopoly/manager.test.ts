import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameManager } from '../../server/games.ts';
import { ownable, streetAt } from './board.ts';
import { buildError, mortgageError, sellError } from './buildings.ts';
import { inGame } from './state.ts';
import { monopoly } from './index.ts';
import type { PublicGameState } from './types.ts';
import type { Random, Result } from '../../shared/types.ts';

type Manager = ReturnType<typeof createGameManager>;

const ROOM = 'monopoly/g1';

// The same rolls on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gameWith(seed: number, ...names: string[]): Manager {
  const manager = createGameManager([monopoly], seeded(seed));
  for (const name of names) manager.join('monopoly', 'g1', name);
  return manager;
}

// The manager is generic over games, so tests narrow the public state to Monopoly's
function ok(result: Result<unknown>): PublicGameState {
  if ('error' in result) assert.fail(result.error);
  return result.state as PublicGameState;
}

function viewOf(manager: Manager, viewer: number | null = null): PublicGameState {
  const state = manager.getState(ROOM, viewer);
  assert.ok(state, 'expected the game to exist');
  return state as PublicGameState;
}

// Simple players: only the first buys, at the price or at auction for $10, and builds while it keeps $100;
// a debtor mortgages what it can and then gives up; otherwise everyone rolls and ends the turn

function step(manager: Manager, buyer = 1): PublicGameState {
  const state = viewOf(manager);
  const seat = state.currentPlayer ?? assert.fail('nobody to act');
  const debt = state.debts[0];
  if (debt) {
    const spaces = Object.keys(state.owners).map(Number);
    const sellable = spaces.find(space => sellError(state, seat, space) === null);
    if (sellable !== undefined) return ok(manager.move(ROOM, seat, { type: 'sellBuilding', space: sellable }));
    const mortgageable = spaces.find(space => mortgageError(state, seat, space) === null);
    if (mortgageable !== undefined) return ok(manager.move(ROOM, seat, { type: 'mortgage', space: mortgageable }));
    return ok(manager.move(ROOM, seat, { type: 'declareBankruptcy' }));
  }
  if (state.mortgageDecisions.length > 0) return ok(manager.move(ROOM, seat, { type: 'liftMortgages', spaces: [] }));
  if (state.auction) {
    const { auction } = state;
    const bidders = inGame(state).filter(other => !auction.passed.includes(other) && other !== auction.highBidder);
    const bidder = bidders[0];
    const offer = auction.highBid + 10;
    if (bidder === buyer && offer <= state.cash[bidder]) return ok(manager.action(ROOM, bidder, { type: 'bid', amount: offer }));
    return ok(manager.action(ROOM, bidder, { type: 'passBid' }));
  }
  if (state.pendingBuy !== null) {
    const price = ownable(state.pendingBuy)?.price ?? 0;
    return ok(manager.move(ROOM, seat, { type: seat === buyer && state.cash[seat] >= price ? 'buy' : 'decline' }));
  }
  const buildable = Object.keys(state.owners).map(Number)
    .find(space => buildError(state, seat, space) === null && state.cash[seat] - (streetAt(space)?.houseCost ?? 0) >= 100);
  if (buildable !== undefined) return ok(manager.move(ROOM, seat, { type: 'build', space: buildable }));
  return ok(manager.move(ROOM, seat, { type: state.canRoll ? 'roll' : 'endTurn' }));
}

test('a rejoin mid-turn shows the same pending buy', () => {
  const manager = gameWith(3, 'A', 'B');
  let state = viewOf(manager);
  for (let moves = 0; state.pendingBuy === null && moves < 200; moves++) {
    const seat = state.currentPlayer ?? assert.fail('nobody to act');
    state = state.auction ? step(manager) : ok(manager.move(ROOM, seat, { type: state.canRoll ? 'roll' : 'endTurn' }));
  }
  const pending = state.pendingBuy ?? assert.fail('nobody landed on a property');
  const seat = state.currentPlayer ?? assert.fail('nobody to act');
  manager.disconnect(ROOM, seat);
  const rejoined = manager.join('monopoly', 'g1', seat === 1 ? 'A' : 'B', true);
  if ('error' in rejoined) assert.fail(rejoined.error);
  const view = rejoined.state as PublicGameState;
  assert.equal(view.pendingBuy, pending);
  assert.equal(view.currentPlayer, seat);
  ok(manager.move(ROOM, seat, { type: 'buy' }));
  assert.equal(viewOf(manager).owners[pending], seat);
});

test('undo takes back a roll and its rent', () => {
  const manager = gameWith(5, 'A', 'B');
  const before = viewOf(manager);
  const seat = before.currentPlayer ?? assert.fail('nobody to act');
  ok(manager.move(ROOM, seat, { type: 'roll' }));
  ok(manager.requestUndo(ROOM, seat));
  const restored = ok(manager.voteUndo(ROOM, seat === 1 ? 2 : 1, true));
  assert.deepEqual(restored.positions, before.positions);
  assert.deepEqual(restored.cash, before.cash);
  assert.equal(restored.canRoll, true);
});

test('a seeded game plays to one player left, and no step shows the deck order', () => {
  const manager = gameWith(7, 'A', 'B', 'C');
  let state = viewOf(manager);
  for (let moves = 0; !state.isGameOver && moves < 20000; moves++) {
    state = step(manager);
    for (const cash of Object.values(state.cash)) assert.ok(cash >= 0);
  }
  assert.equal(state.isGameOver, true);
  assert.equal(state.winners.length, 1);
  assert.equal(state.bankrupt.length, 2);

  const steps = manager.history('monopoly', 'g1') ?? assert.fail('no history');
  assert.ok(steps.length > 10);
  for (const past of steps) {
    assert.equal('decks' in past, false);
    assert.equal(typeof (past as unknown as PublicGameState).deckCounts.chance, 'number');
  }
  const file = manager.gameFile('monopoly', 'g1', new Date());
  assert.ok(file && 'file' in file);
});

test('dismissing a player mid-game puts their properties up for auction', () => {
  const manager = gameWith(11, 'A', 'B', 'C');
  let state = viewOf(manager);
  for (let moves = 0; moves < 400 && !Object.values(state.owners).includes(3); moves++) state = step(manager, 3);
  while (state.auction || state.debts.length > 0) state = step(manager, 3);
  assert.ok(Object.values(state.owners).includes(3), 'C never bought anything');
  manager.disconnect(ROOM, 3);
  ok(manager.requestDismiss(ROOM, 1, 3));
  state = ok(manager.voteDismiss(ROOM, 2, true));
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal(Object.values(state.owners).includes(3), false);
  assert.notEqual(state.auction, null);
  assert.notEqual(state.currentPlayer, 3);
});
