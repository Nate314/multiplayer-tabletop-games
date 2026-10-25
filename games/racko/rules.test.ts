import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import {
  targetScore, applyAction, applyMove, createGameState, deal, deckSize, onPlayerLeft, onUndo, resetLobby, roundPoints, toPublicState
} from './rules.ts';
import type { Card, GameState, PublicGameState, Result, Seat } from './types.ts';

// A repeatable random, so every run deals the same cards
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

function lobby(players: number): GameState {
  const activePlayers = Array.from({ length: players }, (_, index) => index + 1);
  const state: GameState = {
    ...createGameState('g1'),
    activePlayers,
    playerNames: Object.fromEntries(activePlayers.map(seat => [seat, `P${seat}`])),
    currentPlayer: 1
  };
  return resetLobby(state, seeded(7));
}

const ok = (result: Result<GameState>): GameState => {
  if ('error' in result) assert.fail(result.error);
  return result.state;
};
const move = (state: GameState, seat: Seat, input: unknown) => ok(applyMove(state, seat, input, seeded(1)));
const failure = (result: Result<GameState>): string => {
  if (!('error' in result)) assert.fail('expected an error');
  return result.error;
};
const sorted = (cards: Card[]) => [...cards].sort((a, b) => a - b);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

// Seat 1 holds 1 to 10 except slot 4 is 50; the discard top is 5, the draw pile ends in 40
function nearlyDone(): GameState {
  const state = lobby(2);
  return {
    ...state,
    racks: { 1: [1, 2, 3, 4, 50, 6, 7, 8, 9, 10], 2: range(11, 20) },
    drawPile: [60, 40],
    discardPile: [30, 5]
  };
}

const callRackO = () => move(move(nearlyDone(), 1, { type: 'draw', from: 'discard' }), 1, { type: 'place', slot: 4 });

test('deck size per player count follows the article', () => {
  // Wikipedia, Game play: 2 players use cards 1 to 40, 3 players 1 to 50, 4 players the whole 60-card deck
  assert.equal(deckSize(2), 40);
  assert.equal(deckSize(3), 50);
  assert.equal(deckSize(4), 60);
  for (const players of [2, 3, 4]) {
    const state = lobby(players);
    const all = [...Object.values(state.racks).flat(), ...state.drawPile, ...state.discardPile];
    assert.deepEqual(sorted(all), range(1, deckSize(players)));
    assert.equal(state.discardPile.length, 1);
  }
});

test('the deal fills slots in order and the rack cannot be rearranged', () => {
  // Cards go round the table one at a time into the highest open slot, slot 10 first
  const { racks, drawPile, discardPile } = deal(range(1, 40), [1, 2]);
  assert.deepEqual(racks[1], [19, 17, 15, 13, 11, 9, 7, 5, 3, 1]);
  assert.deepEqual(racks[2], [20, 18, 16, 14, 12, 10, 8, 6, 4, 2]);
  assert.deepEqual(discardPile, [40]);
  assert.deepEqual(drawPile, range(21, 39));

  // A turn changes one slot and leaves the others where they are
  const state = { ...lobby(2), racks, drawPile, discardPile };
  const drawn = move(state, 1, { type: 'draw', from: 'discard' });
  const placed = move(drawn, 1, { type: 'place', slot: 3 });
  assert.deepEqual(placed.racks[1], [19, 17, 15, 40, 11, 9, 7, 5, 3, 1]);
  assert.deepEqual(placed.discardPile, [13]);
  assert.match(failure(applyMove(drawn, 1, { type: 'swap', a: 0, b: 1 }, seeded(1))), /Invalid move/);
});

test('a card taken from the discard pile must be placed', () => {
  const state = nearlyDone();
  const drawn = move(state, 1, { type: 'draw', from: 'discard' });
  assert.equal(drawn.held?.card, 5);
  assert.equal(drawn.currentPlayer, 1);
  assert.deepEqual(drawn.discardPile, [30]);
  assert.match(failure(applyMove(drawn, 1, { type: 'discard' }, seeded(1))), /must be placed/);
  assert.match(failure(applyMove(drawn, 1, { type: 'draw', from: 'deck' }, seeded(1))), /already drew/);

  // A card from the deck may be discarded straight away, and the turn passes
  const fromDeck = move(state, 1, { type: 'draw', from: 'deck' });
  assert.equal(fromDeck.held?.card, 40);
  const discarded = move(fromDeck, 1, { type: 'discard' });
  assert.deepEqual(discarded.discardPile, [30, 5, 40]);
  assert.equal(discarded.currentPlayer, 2);
  assert.equal(discarded.held, null);
  assert.deepEqual(discarded.racks[1], state.racks[1]);
});

test('an ascending rack calls Rack-O and ends the round', () => {
  const done = callRackO();
  assert.deepEqual(done.racks[1], range(1, 10));
  assert.equal(done.roundSummary?.caller, 1);
  assert.equal(done.currentPlayer, null);
  assert.equal(done.lastMove?.type === 'place' && done.lastMove.rackO, true);
  assert.match(done.gameStatus, /Rack-O/);
  assert.equal(done.isGameOver, false);
  // A rack that is not in order does not end the round
  const miss = move(move(nearlyDone(), 1, { type: 'draw', from: 'discard' }), 1, { type: 'place', slot: 0 });
  assert.equal(miss.roundSummary, null);
  assert.equal(miss.currentPlayer, 2);
});

test('round scoring follows the article', () => {
  // Wikipedia, Point system: the winner scores 75, everyone else 5 for each card in ascending order from slot 1
  assert.equal(roundPoints([5, 4, 3, 2, 1, 6, 7, 8, 9, 10]), 5);
  assert.equal(roundPoints([1, 2, 3, 9, 4, 5, 6, 7, 8, 10]), 20);
  assert.equal(roundPoints([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 50);
  const done = callRackO();
  // Seat 2 holds 11 to 20 in order, so every card counts
  assert.deepEqual(done.roundSummary?.points, { 1: 75, 2: 50 });
  assert.deepEqual(done.scores, { 1: 75, 2: 50 });
  assert.deepEqual(done.roundSummary?.racks[2], range(11, 20));
});

test('an empty draw pile reshuffles the discards but the top card', () => {
  const state = { ...nearlyDone(), drawPile: [], discardPile: [30, 31, 32, 5] };
  const drawn = move(state, 1, { type: 'draw', from: 'deck' });
  assert.deepEqual(drawn.discardPile, [5]);
  assert.equal(drawn.drawPile.length, 2);
  assert.deepEqual(sorted([drawn.held?.card ?? 0, ...drawn.drawPile]), [30, 31, 32]);
  assert.equal(drawn.lastMove?.type === 'draw' && drawn.lastMove.from === 'deck' && drawn.lastMove.reshuffled, true);
  // With only the top card left there is nothing to draw from the deck
  const stuck = { ...state, drawPile: [], discardPile: [5] };
  assert.match(failure(applyMove(stuck, 1, { type: 'draw', from: 'deck' }, seeded(1))), /no cards/i);
  assert.equal(move(stuck, 1, { type: 'draw', from: 'discard' }).held?.card, 5);
});

test("the game ends at the article's target score", () => {
  assert.equal(targetScore({}), 500);
  const finish = (scores: Record<Seat, number>) =>
    move(move({ ...nearlyDone(), scores }, 1, { type: 'draw', from: 'discard' }), 1, { type: 'place', slot: 4 });

  const short = finish({ 1: 424, 2: 0 });
  assert.equal(short.scores[1], 499);
  assert.equal(short.isGameOver, false);

  const over = finish({ 1: 425, 2: 0 });
  assert.equal(over.scores[1], 500);
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [1]);
  assert.match(over.gameStatus, /wins/);
  assert.ok('error' in applyAction(over, 1, { type: 'acknowledgeRound' }, seeded(1)));

  // Both over 500 in one round: the higher total wins, equal totals share
  assert.deepEqual(finish({ 1: 100, 2: 460 }).winners, [2]);
  assert.deepEqual(finish({ 1: 475, 2: 500 }).winners, [1, 2]);
});

test('Continue deals the next round once every connected player has pressed it', () => {
  const done = callRackO();
  const act = (state: GameState, seat: Seat) => ok(applyAction(state, seat, { type: 'acknowledgeRound' }, seeded(3)));
  const first = act(done, 1);
  assert.deepEqual(first.roundSummary?.acknowledged, [1]);
  assert.equal(first.round, 1);
  const next = act(first, 2);
  assert.equal(next.round, 2);
  assert.equal(next.roundSummary, null);
  assert.equal(next.currentPlayer, 2);
  assert.deepEqual(next.scores, { 1: 75, 2: 50 });
  assert.equal(next.racks[1].length, 10);
  assert.equal(next.discardPile.length, 1);
  assert.match(failure(applyAction(next, 1, { type: 'acknowledgeRound' }, seeded(1))), /Nothing to continue/);

  // A disconnected player is not waited for
  assert.equal(act({ ...done, disconnected: [2] }, 1).round, 2);
});

test('invalid moves return an error and leave the state unchanged', () => {
  const state = nearlyDone();
  const drawn = move(state, 1, { type: 'draw', from: 'deck' });
  const bad: [GameState, Seat, unknown][] = [
    [state, 1, null],
    [state, 1, 'draw'],
    [state, 1, { type: 'draw' }],
    [state, 1, { type: 'draw', from: 'hand' }],
    [state, 1, { type: 'place', slot: 0 }],
    [state, 1, { type: 'discard' }],
    [drawn, 1, { type: 'place', slot: 10 }],
    [drawn, 1, { type: 'place', slot: -1 }],
    [drawn, 1, { type: 'place', slot: 1.5 }],
    [drawn, 1, { type: 'place', slot: '2' }],
    [drawn, 1, { type: 'place' }],
    [drawn, 1, { type: 'draw', from: 'discard' }],
    [{ ...state, isGameOver: true }, 1, { type: 'draw', from: 'deck' }],
    [{ ...state, roundSummary: { round: 1, caller: 1, points: {}, racks: {}, acknowledged: [] } }, 1, { type: 'draw', from: 'deck' }]
  ];
  for (const [before, seat, input] of bad) {
    const snapshot = structuredClone(before);
    assert.ok('error' in applyMove(before, seat, input, seeded(1)), JSON.stringify(input));
    assert.deepEqual(before, snapshot);
  }
  assert.ok('error' in applyAction(state, 1, { type: 'acknowledgeRound' }, seeded(1)));
  assert.ok('error' in applyAction(state, 1, { type: 'nope' }, seeded(1)));
  assert.ok('error' in applyAction(state, 1, null, seeded(1)));
});

test('dismissed player mid-turn', () => {
  const state = lobby(3);
  const drawn = move(state, 1, { type: 'draw', from: 'deck' });
  const cards = (s: GameState) => Object.values(s.racks).flat().length + s.drawPile.length + s.discardPile.length + (s.held ? 1 : 0);
  // The platform has moved the turn on before onPlayerLeft runs
  const left = onPlayerLeft({ ...drawn, activePlayers: [2, 3], currentPlayer: 2 }, 1, seeded(2));
  assert.equal(left.held, null);
  assert.equal(left.currentPlayer, 2);
  assert.equal(left.racks[1], undefined);
  assert.equal(left.scores[1], undefined);
  assert.equal(cards(left), cards(state));
  assert.equal(left.drawPile.length + left.discardPile.length + 20, 50);
  ok(applyMove(left, 2, { type: 'draw', from: 'deck' }, seeded(1)));

  // A player who leaves while another holds a drawn card does not touch it
  const other = onPlayerLeft({ ...drawn, activePlayers: [1, 2] }, 3, seeded(2));
  assert.equal(other.held?.by, 1);

  // Leaving at the scoring screen can complete the Continue
  const pressed = ok(applyAction(callRackO(), 1, { type: 'acknowledgeRound' }, seeded(1)));
  assert.equal(onPlayerLeft({ ...pressed, activePlayers: [1] }, 2, seeded(1)).round, 2);
});

test('table view hides hands', () => {
  let state = lobby(3);
  let views = 0;
  const record = () => {
    for (const viewer of [null, 1, 2, 3]) {
      const view = toPublicState(state, false, viewer) as PublicGameState;
      views++;
      for (const key of ['racks', 'drawPile', 'discardPile', 'held']) assert.equal(key in view, false);
      assert.deepEqual(view.myRack, viewer === null ? [] : state.racks[viewer]);
      // Nobody else's rack appears anywhere in the view
      for (const seat of [1, 2, 3]) {
        if (seat !== viewer) assert.equal(JSON.stringify(view).includes(JSON.stringify(state.racks[seat])), false);
      }
    }
  };
  record();
  for (let step = 0; step < 6; step++) {
    const seat = state.currentPlayer as Seat;
    state = move(state, seat, { type: 'draw', from: 'deck' });
    const held = state.held?.card;
    for (const viewer of [null, 1, 2, 3]) {
      const view = toPublicState(state, false, viewer) as PublicGameState;
      assert.equal(view.heldFrom, 'deck');
      assert.equal(view.myHeld, viewer === seat ? held : null);
      assert.equal('card' in (view.lastMove ?? {}), false);
    }
    record();
    state = move(state, seat, step % 2 ? { type: 'place', slot: step } : { type: 'discard' });
    record();
  }
  assert.ok(views > 20);
  // The scoring screen shows the finished racks
  assert.deepEqual((toPublicState(callRackO(), false, null) as PublicGameState).roundSummary?.racks[2], range(11, 20));
});

test('undo reshuffles', () => {
  const big = { ...nearlyDone(), drawPile: range(21, 40).reverse() };
  const shuffled = onUndo(big, seeded(9));
  assert.deepEqual(sorted(shuffled.drawPile), sorted(big.drawPile));
  assert.notDeepEqual(shuffled.drawPile, big.drawPile);
  assert.deepEqual(shuffled.discardPile, big.discardPile);
  assert.deepEqual(shuffled.racks, big.racks);
});

test('setup: nothing is dealt for one player, and the first seat takes the first turn', () => {
  assert.deepEqual(lobby(1).racks, {});
  const two = lobby(2);
  assert.equal(two.currentPlayer, 1);
  assert.equal(two.round, 1);
  assert.deepEqual(two.scores, { 1: 0, 2: 0 });
  assert.equal(two.drawPile.length, 40 - 20 - 1);
});

test('the game ends at the chosen target', () => {
  const finish = (mine: number, target: number) => move(
    move({ ...nearlyDone(), scores: { 1: mine, 2: 0 }, houseRules: withRules({ targetScore: target }) }, 1, { type: 'draw', from: 'discard' }),
    1, { type: 'place', slot: 4 });
  const over = finish(175, 250); // the round is worth 75
  assert.equal(over.scores[1], 250);
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [1]);
  assert.equal(finish(174, 250).isGameOver, false);
  assert.equal(finish(175, 500).isGameOver, false);
});
