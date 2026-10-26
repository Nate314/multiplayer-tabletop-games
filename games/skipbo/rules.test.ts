import { finalStandings } from './rules.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAND_SIZE, createDeck, createGameState, nextValue, resetLobby, stockSize, toPublicState } from './rules.ts';
import { skipbo } from './index.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { Card, GameState, Result, Seat } from './types.ts';

// A repeatable random, so dealing and reshuffles are the same every run
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

// Test cards get ids from 1000 up, so they never clash with each other
let nextId = 1000;
const num = (value: number): Card => ({ id: nextId++, kind: 'number', value });
const sb = (): Card => ({ id: nextId++, kind: 'skipbo' });
const nums = (...values: number[]) => values.map(num);
const run = (from: number, to: number) => nums(...Array.from({ length: to - from + 1 }, (_, index) => from + index));
const emptyPiles = (): Card[][] => [[], [], [], []];

function ok<T>(result: Result<T>): T {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function refused<T>(result: Result<T>): string {
  if (!('error' in result)) assert.fail('expected the move to be refused');
  return result.error;
}

// Alice to play, her turn already set up, with the hands and piles given
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g1'),
    started: true,
    currentPlayer: 1,
    turnOf: 1,
    activePlayers: [1, 2],
    playerNames: { 1: 'Alice', 2: 'Bob' },
    hands: { 1: nums(5, 6, 7, 8, 9), 2: [] },
    stocks: { 1: nums(10, 11), 2: nums(10, 11) },
    discards: { 1: emptyPiles(), 2: emptyPiles() },
    building: emptyPiles(),
    drawPile: run(1, 12),
    ...overrides
  };
}

const move = (state: GameState, seat: Seat, input: unknown, random = seeded(1)) => applyMove(skipbo, state, seat, input, random);
const fromHand = (index: unknown, to: unknown) => ({ type: 'play', from: { kind: 'hand', index }, to });
const fromStock = (to: number) => ({ type: 'play', from: { kind: 'stock' }, to });
const fromDiscard = (pile: number, to: number) => ({ type: 'play', from: { kind: 'discard', pile }, to });
const discard = (handIndex: number, pile: number) => ({ type: 'discard', handIndex, pile });
const endTurn = { type: 'endTurn' };

function seat(names: string[], random = seeded(7)): GameState {
  let state = createGameState('g1');
  for (const name of names) {
    const added = addPlayer(skipbo, state, name, random);
    if ('error' in added) assert.fail(added.error);
    state = added.state;
  }
  return state;
}

const allCards = (state: GameState): Card[] => [
  ...Object.values(state.hands).flat(),
  ...Object.values(state.stocks).flat(),
  ...Object.values(state.discards).flat(2),
  ...state.building.flat(),
  ...state.drawPile
];

test('deck has 162 cards, twelve of each 1 to 12 and 18 Skip-Bo', () => {
  const deck = createDeck();
  assert.equal(deck.length, 162);
  assert.equal(new Set(deck.map(card => card.id)).size, 162);
  assert.equal(deck.filter(card => card.kind === 'skipbo').length, 18);
  for (let value = 1; value <= 12; value++) {
    assert.equal(deck.filter(card => card.kind === 'number' && card.value === value).length, 12);
  }
});

test('stock is 30 each for 2 to 4 players and 20 for 5 or 6', () => {
  assert.deepEqual([2, 3, 4, 5, 6].map(stockSize), [30, 30, 30, 20, 20]);
  for (const count of [2, 4, 5, 6]) {
    const state = seat(['A', 'B', 'C', 'D', 'E', 'F'].slice(0, count));
    const size = stockSize(count);
    for (const player of state.activePlayers) assert.equal(state.stocks[player].length, size);
    // The first player draws their hand as their turn starts; the others draw on their own turns
    assert.equal(state.hands[1].length, HAND_SIZE);
    for (const player of state.activePlayers.slice(1)) assert.equal(state.hands[player].length, 0);
    assert.equal(state.drawPile.length, 162 - count * size - HAND_SIZE);
    assert.equal(new Set(allCards(state).map(card => card.id)).size, 162);
    assert.equal(state.turnOf, 1);
  }
  const lone = seat(['A']);
  assert.deepEqual(lone.stocks, {});
  assert.equal(lone.drawPile.length, 0);
});

test('hand refills to 5 at turn start and when emptied mid-turn', () => {
  const start = game({ hands: { 1: nums(5, 6, 7), 2: nums(3, 4) } });
  const passed = ok(move(start, 1, discard(0, 2)));
  assert.equal(passed.currentPlayer, 2);
  assert.equal(passed.turnOf, 2);
  assert.equal(passed.hands[2].length, 5);
  assert.deepEqual(passed.hands[2].slice(2).map(card => card.kind === 'number' && card.value), [12, 11, 10]);
  assert.equal(passed.drawPile.length, 9);
  assert.deepEqual(passed.hands[1].length, 2);

  const lastCard = game({ hands: { 1: nums(1), 2: [] } });
  const refilled = ok(move(lastCard, 1, fromHand(0, 0)));
  assert.equal(refilled.currentPlayer, 1);
  assert.equal(refilled.hands[1].length, 5);
  assert.equal(refilled.drawPile.length, 7);
});

test('a building pile starts with 1 or Skip-Bo and takes the next number', () => {
  const state = game({ hands: { 1: nums(2, 1, 3, 2, 9), 2: [] } });
  assert.equal(refused(move(state, 1, fromHand(0, 0))), 'A building pile starts with a 1 or a Skip-Bo');
  const one = ok(move(state, 1, fromHand(1, 0)));
  assert.deepEqual(one.building[0].map(card => card.kind === 'number' && card.value), [1]);
  assert.equal(nextValue(one.building[0]), 2);
  assert.equal(refused(move(one, 1, fromHand(1, 0))), 'That pile needs a 2');
  const two = ok(move(one, 1, fromHand(0, 0)));
  assert.equal(two.building[0].length, 2);
  assert.equal(two.currentPlayer, 1);
  assert.deepEqual(two.lastMove, { playerNumber: 1, type: 'play', from: { kind: 'hand', index: 0 }, to: 0, card: one.hands[1][0], value: 2, completed: false });
  ok(move(game({ hands: { 1: [sb()], 2: [] } }), 1, fromHand(0, 3)));
});

test('a Skip-Bo plays as the next number', () => {
  const wild = sb();
  const state = game({ hands: { 1: [wild, num(4)], 2: [] }, building: [run(1, 2), [], [], []] });
  const played = ok(move(state, 1, fromHand(0, 0)));
  assert.equal(played.lastMove?.type === 'play' && played.lastMove.value, 3);
  assert.equal(nextValue(played.building[0]), 4);
  const four = ok(move(played, 1, fromHand(0, 0)));
  assert.equal(four.building[0].length, 4);
});

test('a pile reaching 12 is shuffled into the draw pile', () => {
  const pile = run(1, 11);
  const twelve = num(12);
  const state = game({ hands: { 1: [twelve, num(3)], 2: [] }, building: [[], pile, [], []] });
  const done = ok(move(state, 1, fromHand(0, 1)));
  assert.deepEqual(done.building[1], []);
  assert.equal(done.drawPile.length, state.drawPile.length + 12);
  const drawIds = new Set(done.drawPile.map(card => card.id));
  assert.ok([...pile, twelve].every(card => drawIds.has(card.id)));
  assert.equal(done.lastMove?.type === 'play' && done.lastMove.completed, true);
  assert.match(done.gameStatus, /completed building pile 2/);

  // A Skip-Bo can be the 12 too
  const wild = ok(move(game({ hands: { 1: [sb()], 2: [] }, building: [run(1, 11), [], [], []] }), 1, fromHand(0, 0)));
  assert.deepEqual(wild.building[0], []);
});

test('cards come from the stock top and discard tops, and the stock shows its next card', () => {
  const state = game({
    stocks: { 1: nums(9, 1), 2: nums(4) },
    discards: { 1: [nums(7, 2), [], [], []], 2: emptyPiles() }
  });
  const stock = ok(move(state, 1, fromStock(2)));
  assert.deepEqual(stock.stocks[1].map(card => card.kind === 'number' && card.value), [9]);
  const fromPile = ok(move(stock, 1, fromDiscard(0, 2)));
  assert.equal(fromPile.discards[1][0].length, 1);
  assert.equal(fromPile.building[2].length, 2);
  assert.equal(refused(move(fromPile, 1, fromDiscard(1, 0))), 'That discard pile is empty');
  assert.equal(refused(move(game({ stocks: { 1: [], 2: [] } }), 1, fromStock(0))), 'Your stock is empty');
});

test('a discard goes on any of your own four piles and ends the turn', () => {
  const state = game({ discards: { 1: [nums(12), [], [], []], 2: emptyPiles() } });
  const done = ok(move(state, 1, discard(4, 0)));
  assert.deepEqual(done.discards[1][0].map(card => card.kind === 'number' && card.value), [12, 9]);
  assert.equal(done.currentPlayer, 2);
  assert.equal(done.lastMove?.type, 'discard');
  assert.equal(refused(move(done, 1, discard(0, 0))), 'Not your turn');
});

test('cannot play from a discard pile onto another discard pile or play to a discard pile except to end the turn', () => {
  const state = game({ discards: { 1: [nums(1), [], [], []], 2: emptyPiles() } });
  const before = structuredClone(state);
  const bad = [
    { type: 'play', from: { kind: 'discard', pile: 0 }, to: { kind: 'discard', pile: 1 } },
    { type: 'play', from: { kind: 'discard', pile: 0 }, to: 4 },
    { type: 'play', from: { kind: 'hand', index: 0 }, to: { kind: 'discard', pile: 1 } },
    { type: 'discard', from: { kind: 'discard', pile: 0 }, pile: 1 },
    { type: 'discard', from: { kind: 'stock' }, pile: 1 }
  ];
  for (const input of bad) assert.equal(refused(move(state, 1, input)), 'Invalid move');
  assert.deepEqual(state, before);
});

test('invalid moves', () => {
  const state = game({ stocks: { 1: [], 2: nums(1) } });
  const before = structuredClone(state);
  const bad: [unknown, string][] = [
    [null, 'Invalid move'],
    ['play', 'Invalid move'],
    [{ type: 'fly' }, 'Invalid move'],
    [{ type: 'play' }, 'Invalid move'],
    [fromHand(-1, 0), 'Invalid move'],
    [fromHand(1.5, 0), 'Invalid move'],
    [fromHand(0, -1), 'Invalid move'],
    [fromHand(0, '0'), 'Invalid move'],
    [fromHand(5, 0), 'That card is not in your hand'],
    [fromHand(0, 0), 'A building pile starts with a 1 or a Skip-Bo'],
    [fromStock(0), 'Your stock is empty'],
    [fromDiscard(2, 0), 'That discard pile is empty'],
    [discard(9, 0), 'That card is not in your hand'],
    [discard(0, 4), 'Invalid move'],
    [discard(0, 1.5), 'Invalid move'],
    [endTurn, 'You can end your turn only by discarding'],
    [{ type: 'play', from: { kind: 'hand', index: 0 }, to: 0, extra: { kind: 'hand' } }, 'A building pile starts with a 1 or a Skip-Bo']
  ];
  for (const [input, error] of bad) assert.equal(refused(move(state, 1, input)), error, JSON.stringify(input));
  assert.equal(refused(move(state, 2, discard(0, 0))), 'Not your turn');
  assert.equal(refused(move(state, 3, discard(0, 0))), 'Not your turn');
  assert.deepEqual(state, before);
});

test('emptying the stock wins', () => {
  const state = game({ stocks: { 1: nums(1), 2: nums(5, 6) } });
  const won = ok(move(state, 1, fromStock(0)));
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
  assert.equal(won.currentPlayer, null);
  assert.equal(won.gameStatus, 'Alice played the last card of their stock and wins!');
  assert.equal(refused(move(won, 1, discard(0, 0))), 'The game is over');
});

test('an empty draw pile with no completed piles to reshuffle does not throw', () => {
  const state = game({ hands: { 1: nums(1), 2: [] }, drawPile: [] });
  const emptied = ok(move(state, 1, fromHand(0, 0)));
  assert.deepEqual(emptied.hands[1], []);
  assert.equal(emptied.currentPlayer, 1);
  assert.equal(refused(move(emptied, 1, discard(0, 0))), 'That card is not in your hand');
  // With nothing to discard, the turn ends with End turn
  const ended = ok(move(emptied, 1, endTurn));
  assert.equal(ended.currentPlayer, 2);
  assert.deepEqual(ended.hands[2], []);
  assert.deepEqual(ended.lastMove, { playerNumber: 1, type: 'endTurn' });
  // Bob can still play from his stock, and a completed pile refills the draw pile for his hand
  const bobsTurn = { ...ended, building: [run(1, 9), [], [], []], stocks: { ...ended.stocks, 2: nums(4, 12, 11, 10) } };
  const ten = ok(move(bobsTurn, 2, fromStock(0)));
  assert.equal(ten.building[0].length, 10);
  assert.deepEqual(ten.hands[2], []);
  const full = ok(move(ok(move(ten, 2, fromStock(0))), 2, fromStock(0)));
  assert.equal(full.building[0].length, 0);
  assert.equal(full.hands[2].length, 5);
  assert.equal(full.drawPile.length, 7);
});

test('when every player ends a turn in a row with nothing to play, the fewest stock cards win', () => {
  const state = game({
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Carol' },
    hands: { 1: [], 2: [], 3: [] },
    stocks: { 1: nums(5, 5), 2: nums(5), 3: nums(5) },
    discards: { 1: emptyPiles(), 2: emptyPiles(), 3: emptyPiles() },
    drawPile: []
  });
  const one = ok(move(state, 1, endTurn));
  const two = ok(move(one, 2, endTurn));
  assert.equal(two.isGameOver, false);
  const three = ok(move(two, 3, endTurn));
  assert.equal(three.isGameOver, true);
  assert.deepEqual(three.winners, [2, 3]);
  assert.equal(three.gameStatus, 'Nobody can play. Bob and Carol win with the fewest stock cards left.');

  // A play in between starts the count again
  const played = ok(move({ ...one, hands: { ...one.hands, 2: nums(1) } }, 2, fromHand(0, 0)));
  assert.equal(played.passes, 0);
});

test('an ended turn counts toward nobody can play only with nothing played and nothing playable', () => {
  const stuck = game({ hands: { 1: [], 2: [] }, stocks: { 1: nums(5, 5, 1), 2: nums(5) }, drawPile: [] });
  // Alice could play her stock 1, so ending her turn does not count
  const aliceCould = ok(move(stuck, 1, endTurn));
  assert.equal(aliceCould.passes, 0);
  // Bob has nothing to play
  const bobStuck = ok(move(aliceCould, 2, endTurn));
  assert.equal(bobStuck.passes, 1);
  assert.equal(bobStuck.isGameOver, false);
  // Alice plays her 1, leaving a 5 she cannot play: she played this turn, so the count starts again
  const played = ok(move(ok(move(bobStuck, 1, fromStock(0))), 1, endTurn));
  assert.equal(played.passes, 0);
  assert.equal(played.isGameOver, false);
  const bobAgain = ok(move(played, 2, endTurn));
  assert.equal(bobAgain.passes, 1);
  const over = ok(move(bobAgain, 1, endTurn));
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [2]);
  assert.equal(over.gameStatus, 'Nobody can play. Bob wins with the fewest stock cards left.');

  // A playable discard top counts as a play left too
  const discardTop = game({
    hands: { 1: [], 2: [] },
    stocks: { 1: nums(5), 2: nums(5) },
    discards: { 1: [[], [], nums(1), []], 2: emptyPiles() },
    drawPile: [],
    passes: 1
  });
  const notCounted = ok(move(discardTop, 1, endTurn));
  assert.equal(notCounted.passes, 0);
  assert.equal(notCounted.isGameOver, false);
});

test('a turn that was never set up, as after an undo across a dismissal, is set up before the move', () => {
  const state = game({ turnOf: 3, hands: { 1: [], 2: [] } });
  const done = ok(move(state, 1, discard(0, 0)));
  assert.deepEqual(done.discards[1][0].map(card => card.kind === 'number' && card.value), [12]);
  assert.equal(done.hands[1].length, 4);
  assert.equal(done.currentPlayer, 2);
});

test('the public counts list only seated players', () => {
  const state = game({
    stocks: { 1: nums(1), 2: nums(2), 3: nums(3) },
    hands: { 1: nums(4), 2: [], 3: nums(5) }
  });
  const view = toPublicState(state, false, 1);
  assert.deepEqual(Object.keys(view.stockCounts), ['1', '2']);
  assert.deepEqual(Object.keys(view.stockTops), ['1', '2']);
  assert.deepEqual(Object.keys(view.handCounts), ['1', '2']);
});

test('turns go round the table in seat order', () => {
  const state = game({
    activePlayers: [1, 3, 4],
    playerNames: { 1: 'Alice', 3: 'Carol', 4: 'Dan' },
    hands: { 1: nums(5, 6, 7, 8, 9), 3: [], 4: [] },
    stocks: { 1: nums(10), 3: nums(10), 4: nums(10) },
    discards: { 1: emptyPiles(), 3: emptyPiles(), 4: emptyPiles() },
    drawPile: run(1, 12)
  });
  const carol = ok(move(state, 1, discard(0, 0)));
  assert.equal(carol.currentPlayer, 3);
  const dan = ok(move(carol, 3, discard(0, 0)));
  assert.equal(dan.currentPlayer, 4);
  assert.equal(ok(move(dan, 4, discard(0, 0))).currentPlayer, 1);
});

test('dismissed player mid-turn', () => {
  const state = game({
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Carol' },
    currentPlayer: 2,
    turnOf: 2,
    hands: { 1: nums(1, 2, 3, 4, 5), 2: nums(6, 7), 3: nums(8) },
    stocks: { 1: nums(9), 2: nums(10, 11), 3: nums(12) },
    discards: { 1: emptyPiles(), 2: [nums(4), [], [], []], 3: emptyPiles() },
    building: [nums(1), [], [], []],
    drawPile: run(1, 10)
  });
  const total = allCards(state).length;
  const left = removePlayer(skipbo, { ...state, disconnected: [2] }, 2, seeded(3));
  assert.equal(left.currentPlayer, 3);
  assert.equal(left.turnOf, 3);
  assert.equal(left.hands[3].length, 5);
  assert.equal(left.hands[1].length, 5);
  assert.equal('2' in left.hands || '2' in left.stocks || '2' in left.discards, false);
  assert.equal(allCards(left).length, total);
  assert.equal(left.building[0].length, 1);
  ok(move(left, 3, discard(0, 0)));

  // Dismissed while someone else is mid-turn: that player's hand is left alone
  const other = removePlayer(skipbo, { ...state, currentPlayer: 1, turnOf: 1, hands: { ...state.hands, 1: nums(1) } }, 3, seeded(3));
  assert.equal(other.currentPlayer, 1);
  assert.equal(other.hands[1].length, 1);

  // The last player left wins
  const two = removePlayer(skipbo, removePlayer(skipbo, state, 2, seeded(3)), 3, seeded(3));
  assert.equal(two.isGameOver, true);
  assert.deepEqual(two.winners, [1]);
});

// Every card object in a view, wherever it sits
function cardsIn(value: unknown): Card[] {
  if (Array.isArray(value)) return value.flatMap(cardsIn);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'number' && (record.kind === 'number' || record.kind === 'skipbo')) return [record as Card];
    return Object.values(record).flatMap(cardsIn);
  }
  return [];
}

// Plays a short game with a simple strategy: the stock first, then any hand card, else discard
function botMove(state: GameState): unknown {
  const player = state.currentPlayer as Seat;
  const fits = (card: Card | undefined, pile: number) =>
    card !== undefined && (card.kind === 'skipbo' || card.value === nextValue(state.building[pile]));
  for (let pile = 0; pile < 4; pile++) if (fits(state.stocks[player].at(-1), pile)) return fromStock(pile);
  for (let pile = 0; pile < 4; pile++) {
    const index = state.hands[player].findIndex(card => fits(card, pile));
    if (index >= 0) return fromHand(index, pile);
  }
  return state.hands[player].length > 0 ? discard(0, state.hands[player].length % 4) : endTurn;
}

test('table view hides hands', () => {
  let state = seat(['A', 'B', 'C'], seeded(11));
  const states = [state];
  for (let step = 0; step < 120 && !state.isGameOver; step++) {
    state = ok(move(state, state.currentPlayer as Seat, botMove(state), seeded(step)));
    states.push(state);
  }
  assert.ok(states.some(past => past.building.some(pile => pile.length > 0)));
  assert.ok(states.some(past => past.lastMove?.type === 'play' && past.lastMove.completed));
  for (const past of states) {
    // A 12 that completed a pile was played face up before it went into the draw pile, so the last move may name it
    const shown = past.lastMove?.type === 'play' ? past.lastMove.card.id : null;
    const hidden = new Set([
      ...Object.values(past.hands).flat(),
      ...Object.values(past.stocks).flatMap(stock => stock.slice(0, -1)),
      ...past.drawPile
    ].map(card => card.id).filter(id => id !== shown));
    const table = toPublicState(past, false, null);
    assert.equal('hands' in table || 'stocks' in table || 'drawPile' in table, false);
    assert.deepEqual(table.myHand, []);
    assert.equal(cardsIn(table).filter(card => hidden.has(card.id)).length, 0);
    for (const player of past.activePlayers) {
      assert.equal(table.stockCounts[player], past.stocks[player].length);
      assert.deepEqual(table.stockTops[player], past.stocks[player].at(-1) ?? null);
      assert.equal(table.handCounts[player], past.hands[player].length);
    }
    assert.equal(table.drawCount, past.drawPile.length);

    // "View as" shows that seat's own hand and nothing else hidden
    const own = toPublicState(past, false, 2);
    assert.deepEqual(own.myHand, past.hands[2]);
    const ownIds = new Set(past.hands[2].map(card => card.id));
    assert.equal(cardsIn(own).filter(card => hidden.has(card.id) && !ownIds.has(card.id)).length, 0);
  }
});

test('the lobby deals afresh when players join or leave', () => {
  const three = seat(['A', 'B', 'C']);
  const left = removePlayer(skipbo, three, 3, seeded(2));
  assert.deepEqual(Object.keys(left.stocks), ['1', '2']);
  assert.equal(left.stocks[1].length, 30);
  assert.equal(left.started, false);
  assert.equal(resetLobby(left, seeded(2)).drawPile.length, 162 - 60 - 5);
});

test('finalStandings ranks by the fewest stock cards left', () => {
  const stock = (count: number): GameState['stocks'][number] => Array.from({ length: count }, (_, id) => ({ id, kind: 'skipbo' as const }));
  const state: GameState = {
    ...createGameState('t'), activePlayers: [1, 2, 3], isGameOver: true, winners: [2], stocks: { 1: stock(5), 2: stock(0), 3: stock(5) }
  };
  assert.deepEqual(finalStandings(state), [
    { seat: 2, place: 1, score: '0 left in stock' },
    { seat: 1, place: 2, score: '5 left in stock' }, { seat: 3, place: 2, score: '5 left in stock' }
  ]);
});
