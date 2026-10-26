import { finalStandings } from './rules.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, dealFrom, handSize, toPublicState } from './rules.ts';
import { gofish } from './index.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import { standardDeck } from '../../shared/playingCards.ts';
import type { Random } from '../../shared/types.ts';
import type { GameState, Move, PlayingCard, PublicGameState, Rank, Result, Seat } from './types.ts';

const c = (rank: Rank, suit: PlayingCard['suit'] = 'clubs'): PlayingCard => ({ rank, suit });
const four = (rank: Rank): PlayingCard[] => [c(rank, 'clubs'), c(rank, 'diamonds'), c(rank, 'hearts'), c(rank, 'spades')];

// Always picks the last index, so a shuffle leaves the deck in order
const noShuffle = () => 0.999999;

// The same numbers on every run
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lobby(count: number, random: Random = seeded(count)): GameState {
  let state = createGameState('g');
  for (let i = 1; i <= count; i++) {
    const result = addPlayer(gofish, state, `P${i}`, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// A three-player game under way with small known hands; the top of the stock is the last card
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    hands: {
      1: [c('7'), c('9'), c('K')],
      2: [c('7', 'hearts'), c('7', 'spades'), c('2')],
      3: [c('3'), c('4')]
    },
    stock: [c('5'), c('6'), c('Q')],
    books: { 1: [], 2: [], 3: [] },
    ...overrides
  };
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const ask = (state: GameState, seat: Seat, target: unknown, rank: unknown) =>
  applyMove(gofish, state, seat, { type: 'ask', target, rank }, noShuffle);

const total = (state: GameState) =>
  state.stock.length + Object.values(state.hands).flat().length + Object.values(state.books).flat().length * 4;

test('deal is 7 each for 2 or 3 players and 5 for 4 or more', () => {
  assert.deepEqual([2, 3, 4, 5, 6].map(handSize), [7, 7, 5, 5, 5]);
  for (const count of [2, 3, 4, 6]) {
    const state = lobby(count);
    for (const seat of state.activePlayers) {
      assert.equal(state.hands[seat].length + state.books[seat].length * 4, handSize(count));
    }
    assert.equal(state.stock.length, 52 - count * handSize(count));
    assert.equal(total(state), 52);
    assert.ok(state.activePlayers.includes(state.currentPlayer ?? 0));
  }
  // One player alone is dealt nothing
  assert.deepEqual(lobby(1).hands, { 1: [] });
});

test('a hit hands over every card of the rank and the asker goes again', () => {
  const next = ok(ask(game(), 1, 2, '7'));
  assert.deepEqual(next.hands[1], [c('7'), c('9'), c('K'), c('7', 'hearts'), c('7', 'spades')]);
  assert.deepEqual(next.hands[2], [c('2')]);
  assert.equal(next.currentPlayer, 1);
  assert.deepEqual(next.stock, game().stock);
  assert.deepEqual(next.lastMove, { asker: 1, target: 2, rank: '7', given: 2, fished: 'none', books: [], goesAgain: true });
  assert.equal(next.gameStatus, 'Alice asked Bob for 7s and got 2. Alice goes again.');
});

test('go fish drawing the asked rank goes again, any other card passes the turn', () => {
  const lucky = ok(ask(game({ stock: [c('5'), c('9', 'hearts')] }), 1, 3, '9'));
  assert.deepEqual(lucky.hands[1], [c('7'), c('9'), c('K'), c('9', 'hearts')]);
  assert.equal(lucky.currentPlayer, 1);
  assert.equal(lucky.lastMove?.fished, 'asked');
  assert.equal(lucky.gameStatus, 'Alice asked Cara for 9s: go fish! Alice drew a 9. Alice goes again.');

  const unlucky = ok(ask(game(), 1, 3, '9'));
  assert.deepEqual(unlucky.hands[1], [c('7'), c('9'), c('K'), c('Q')]);
  assert.deepEqual(unlucky.stock, [c('5'), c('6')]);
  assert.equal(unlucky.currentPlayer, 2);
  assert.equal(unlucky.lastMove?.fished, 'other');
  assert.equal(unlucky.gameStatus, 'Alice asked Cara for 9s: go fish! Alice drew a card.');

  // With nothing to draw the turn passes too
  const dry = ok(ask(game({ stock: [] }), 1, 3, '9'));
  assert.equal(dry.lastMove?.fished, 'empty');
  assert.equal(dry.currentPlayer, 2);
  assert.equal(dry.gameStatus, 'Alice asked Cara for 9s: go fish! The stock is empty.');
});

test('four of a rank are laid down as a book at once', () => {
  const hands = { 1: [c('7', 'clubs'), c('7', 'diamonds'), c('9')], 2: [c('7', 'hearts'), c('7', 'spades'), c('2')], 3: [c('3')] };
  const next = ok(ask(game({ hands }), 1, 2, '7'));
  assert.deepEqual(next.hands[1], [c('9')]);
  assert.deepEqual(next.books[1], ['7']);
  assert.deepEqual(next.lastMove?.books, ['7']);
  assert.equal(next.gameStatus, 'Alice asked Bob for 7s and got 2. Alice laid down the 7s. Alice goes again.');

  // A fished card can complete a book too
  const fished = ok(ask(game({
    hands: { 1: [c('9', 'clubs'), c('9', 'diamonds'), c('9', 'hearts'), c('K')], 2: [c('2')], 3: [c('3')] },
    stock: [c('5'), c('9', 'spades')]
  }), 1, 2, '9'));
  assert.deepEqual(fished.books[1], ['9']);
  assert.equal(fished.currentPlayer, 1);

  // Books completed by the deal go down before the first turn
  const players = createGameState('g');
  const seated: GameState = { ...players, activePlayers: [1, 2], playerNames: { 1: 'A', 2: 'B' } };
  const top = [...four('A'), c('2'), c('3'), c('4')];
  const deck = [...top, ...standardDeck().filter(card => !top.some(held => held.rank === card.rank && held.suit === card.suit))];
  const dealt = dealFrom(seated, deck, 1);
  assert.deepEqual(dealt.books[1], ['A']);
  assert.deepEqual(dealt.hands[1], [c('2'), c('3'), c('4')]);
  assert.equal(total(dealt), 52);
});

test('a player with an empty hand draws one, or is out when the stock is empty', () => {
  // Bob gives away his only cards and draws the top of the stock
  const hands = { 1: [c('7'), c('9')], 2: [c('7', 'hearts')], 3: [c('3'), c('4')] };
  const refilled = ok(ask(game({ hands }), 1, 2, '7'));
  assert.deepEqual(refilled.hands[2], [c('Q')]);
  assert.deepEqual(refilled.stock, [c('5'), c('6')]);

  // With the stock empty Bob is out, and the turn skips him
  const out = ok(ask(game({ hands, stock: [] }), 1, 2, '7'));
  assert.deepEqual(out.hands[2], []);
  const passed = ok(ask(out, 1, 3, '9'));
  assert.equal(passed.currentPlayer, 3);
  assert.deepEqual(ask(passed, 3, 2, '3'), { error: 'Bob has no cards' });

  // An asker who lays down their last cards draws one and keeps asking
  const last = ok(ask(game({
    hands: { 1: [c('7', 'clubs'), c('7', 'diamonds')], 2: [c('7', 'hearts'), c('7', 'spades'), c('2')], 3: [c('3')] }
  }), 1, 2, '7'));
  assert.deepEqual(last.hands[1], [c('Q')]);
  assert.equal(last.currentPlayer, 1);

  // With the stock empty that asker is out and the turn moves on
  const done = ok(ask(game({
    hands: { 1: [c('7', 'clubs'), c('7', 'diamonds')], 2: [c('7', 'hearts'), c('7', 'spades'), c('2')], 3: [c('3')] },
    stock: []
  }), 1, 2, '7'));
  assert.deepEqual(done.hands[1], []);
  assert.equal(done.currentPlayer, 2);
});

test('the game ends with all 13 books, most books win, ties share', () => {
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const nearly = (books: Record<Seat, Rank[]>) => game({
    hands: { 1: [c('7', 'clubs'), c('7', 'diamonds')], 2: [c('7', 'hearts'), c('7', 'spades')], 3: [] },
    stock: [],
    books
  });

  const won = ok(ask(nearly({ 1: ranks.slice(0, 4), 2: ranks.slice(4, 9), 3: ranks.slice(9) }), 1, 2, '7'));
  assert.equal(won.isGameOver, true);
  assert.equal(won.currentPlayer, null);
  assert.deepEqual(won.winners, [1, 2]);
  assert.equal(won.gameStatus, 'Alice asked Bob for 7s and got 2. Alice laid down the 7s. Alice and Bob tie with 5 books each!');

  const single = ok(ask(nearly({ 1: ranks.slice(0, 6), 2: ranks.slice(6, 9), 3: ranks.slice(9) }), 1, 2, '7'));
  assert.deepEqual(single.winners, [1]);
  assert.match(single.gameStatus, /Alice wins with 7 books!$/);
  assert.deepEqual(applyMove(gofish, single, 1, { type: 'ask', target: 2, rank: '2' }), { error: 'The game is over' });
});

test('the ask log is public in every view', () => {
  let state = ok(ask(game(), 1, 2, '7'));
  state = ok(ask(state, 1, 3, '9'));
  assert.equal(state.log.length, 2);
  for (const viewer of [null, 1, 2, 3]) {
    const view = toPublicState(state, false, viewer);
    assert.deepEqual(view.log, state.log);
    assert.deepEqual(view.lastMove, state.log[1]);
  }
});

test('the drawn card is shown to the asker, and to everyone when it was the asked rank', () => {
  const unlucky = ok(ask(game(), 1, 3, '9'));
  assert.deepEqual(toPublicState(unlucky, false, 1).fishedCard, c('Q'));
  for (const viewer of [null, 2, 3]) assert.equal(toPublicState(unlucky, false, viewer).fishedCard, null);

  const lucky = ok(ask(game({ stock: [c('9', 'hearts')] }), 1, 3, '9'));
  for (const viewer of [null, 1, 2, 3]) assert.deepEqual(toPublicState(lucky, false, viewer).fishedCard, c('9', 'hearts'));

  // The next ask forgets it
  const after = ok(ask(lucky, 1, 2, '7'));
  assert.equal(after.fishedCard, null);
});

test('invalid moves', () => {
  const state = game();
  const cases: [unknown, string][] = [
    [{ type: 'ask', target: 2, rank: '2' }, 'You can only ask for a rank you hold'],
    [{ type: 'ask', target: 1, rank: '7' }, 'Ask another player'],
    [{ type: 'ask', target: 4, rank: '7' }, 'That player is not in the game'],
    [{ type: 'ask', target: 2.5, rank: '7' }, 'Invalid move'],
    [{ type: 'ask', target: -1, rank: '7' }, 'Invalid move'],
    [{ type: 'ask', target: '2', rank: '7' }, 'Invalid move'],
    [{ type: 'ask', target: 2, rank: '1' }, 'Invalid move'],
    [{ type: 'ask', target: 2 }, 'Invalid move'],
    [{ type: 'draw' }, 'Invalid move'],
    [null, 'Invalid move'],
    ['ask', 'Invalid move']
  ];
  for (const [made, error] of cases) assert.deepEqual(applyMove(gofish, state, 1, made, noShuffle), { error });
  assert.deepEqual(applyMove(gofish, state, 2, { type: 'ask', target: 1, rank: '7' }, noShuffle), { error: 'Not your turn' });
  assert.deepEqual(ask(game({ hands: { ...game().hands, 3: [] } }), 1, 3, '7'), { error: 'Cara has no cards' });
  assert.deepEqual(state, game());
});

test('dismissed player mid-turn', () => {
  // Alice hit and is asking again when she is dismissed; her cards go into the stock and Bob plays
  const asking = ok(ask(game(), 1, 2, '7'));
  const left = removePlayer(gofish, asking, 1, noShuffle);
  assert.deepEqual(left.activePlayers, [2, 3]);
  assert.equal(left.currentPlayer, 2);
  assert.equal('1' in left.hands, false);
  assert.equal(left.stock.length, asking.stock.length + asking.hands[1].length);
  assert.equal(total(left), total(asking));
  assert.ok(ok(ask(left, 2, 3, '2')));

  // The next seat was out of cards: Bob draws one of Alice's cards from the stock and plays
  const refilled = removePlayer(gofish, game({ hands: { ...game().hands, 2: [] }, stock: [] }), 1, noShuffle);
  assert.equal(refilled.currentPlayer, 2);
  assert.equal(refilled.hands[2].length, 1);
  assert.equal(refilled.stock.length, 2);

  // A dismissed player's books still count toward the 13
  const books = removePlayer(gofish, game({ books: { 1: ['A'], 2: [], 3: [] } }), 2, noShuffle);
  assert.deepEqual(books.books[1], ['A']);
  assert.equal(books.currentPlayer, 1);
});

// A legal move from the asker's own view: a rank they hold, from another player with cards, both picked by `random`
// (a fixed choice can ask the same question forever once the stock is empty)
function anyMove(view: PublicGameState, random: Random): Move {
  const seat = view.currentPlayer ?? assert.fail('nobody to move');
  const others = view.activePlayers.filter(other => other !== seat && view.handCounts[other] > 0);
  assert.ok(others.length > 0, 'nobody to ask');
  const target = others[Math.floor(random() * others.length)];
  return { type: 'ask', target, rank: view.hand[Math.floor(random() * view.hand.length)].rank };
}

test('table view hides hands', () => {
  let state = lobby(3, seeded(7));
  const random = seeded(8);
  const steps: GameState[] = [state];
  while (!state.isGameOver) {
    const seat = state.currentPlayer ?? assert.fail('nobody to move');
    state = ok(applyMove(gofish, state, seat, anyMove(toPublicState(state, false, seat) as PublicGameState, random)));
    steps.push(state);
    assert.ok(steps.length < 2000, 'the game should end');
  }
  assert.equal(Object.values(state.books).flat().length, 13);
  for (const step of steps) {
    assert.equal(total(step), 52);
    const view = toPublicState(step, false, null);
    assert.deepEqual(view.hand, []);
    for (const key of ['hands', 'stock']) assert.equal(key in view, false);
    if (step.lastMove?.fished === 'other') assert.equal(view.fishedCard, null);
    assert.ok(!JSON.stringify(view).includes('"suit"') || view.fishedCard !== null);
    for (const seat of step.activePlayers) assert.deepEqual(toPublicState(step, false, seat).hand, step.hands[seat]);
  }
});

test('finalStandings ranks by books', () => {
  const state: GameState = {
    ...createGameState('t'), activePlayers: [1, 2, 3, 4], isGameOver: true, winners: [3],
    books: { 1: ['2'], 2: ['5'], 3: ['7', '8', '9'], 4: [] }
  };
  assert.deepEqual(finalStandings(state), [
    { seat: 3, place: 1, score: '3 books' },
    { seat: 1, place: 2, score: '1 book' }, { seat: 2, place: 2, score: '1 book' },
    { seat: 4, place: 3, score: '0 books' }
  ]);
});
