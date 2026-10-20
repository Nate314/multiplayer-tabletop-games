import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HAND_SIZE, TARGET_SCORE, cardPoints, createGameState, dealHand, passDirection, playError, sortHand, toPublicState
} from './rules.ts';
import { hearts } from './index.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import { cardName, sameCard, standardDeck, type Rank, type Suit } from '../../shared/playingCards.ts';
import type { Random } from '../../shared/types.ts';
import type { GameState, PlayingCard, Result } from './types.ts';

const c = (rank: Rank, suit: Suit): PlayingCard => ({ rank, suit });
const club = (rank: Rank) => c(rank, 'clubs');
const diamond = (rank: Rank) => c(rank, 'diamonds');
const heart = (rank: Rank) => c(rank, 'hearts');
const spade = (rank: Rank) => c(rank, 'spades');
const QS = spade('Q');

function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lobby(count = 4): GameState {
  let state = createGameState('g');
  for (const name of ['Alice', 'Bob', 'Cara', 'Dan'].slice(0, count)) {
    const result = addPlayer(hearts, state, name, seeded(7));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

function ok(result: Result<GameState> | undefined): GameState {
  if (!result) assert.fail('no result');
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Moves through the platform, which checks the turn first
const move = (state: GameState, seat: number, m: unknown) => applyMove(hearts, state, seat, m, seeded(3));
const act = (state: GameState, seat: number, action: unknown) => hearts.applyAction?.(state, seat, action, seeded(3));
const pass = (state: GameState, seat: number, cards: unknown = [0, 1, 2]) => act(state, seat, { type: 'pass', cards });

function passAll(state: GameState): GameState {
  for (const seat of [1, 2, 3, 4]) state = ok(pass(state, seat));
  return state;
}

// A hand under way, after the first trick, with hearts not broken and Alice to lead
function game(hands: Record<number, PlayingCard[]>, overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2, 3, 4],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara', 4: 'Dan' },
    phase: 'play',
    hands,
    tricksPlayed: 1,
    ...overrides
  };
}

// Plays each card in turn, starting with the current player
function playAll(state: GameState, cards: PlayingCard[]): GameState {
  for (const card of cards) state = ok(move(state, state.currentPlayer ?? assert.fail('nobody to play'), { type: 'play', card }));
  return state;
}

// Plays a whole hand with the first legal card each time
function playHand(state: GameState): GameState {
  while (state.phase === 'play') {
    const seat = state.currentPlayer ?? assert.fail('nobody to play');
    const card = state.hands[seat].find(held => playError(state.hands[seat], held, state) === null);
    state = ok(move(state, seat, { type: 'play', card }));
  }
  return state;
}

const allCards = (state: GameState) => [...Object.values(state.hands).flat(), ...Object.values(state.passes).flat()];

test('four players are dealt the whole deck, 13 each, sorted', () => {
  assert.equal(allCards(lobby(3)).length, 0);
  const state = lobby();
  assert.equal(state.phase, 'passing');
  assert.equal(state.started, false);
  assert.equal(state.currentPlayer, null);
  assert.equal(new Set(allCards(state).map(cardName)).size, 52);
  for (const seat of [1, 2, 3, 4]) {
    assert.equal(state.hands[seat].length, HAND_SIZE);
    assert.deepEqual(state.hands[seat], sortHand(state.hands[seat]));
  }
});

test('pass direction cycles left, right, across, none', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(passDirection), ['left', 'right', 'across', 'none', 'left', 'right', 'across', 'none']);
  const check = (handNumber: number, receiver: Record<number, number>) => {
    const dealt = dealHand({ ...lobby(), handNumber }, seeded(handNumber));
    const sent = Object.fromEntries([1, 2, 3, 4].map(seat => [seat, dealt.hands[seat].slice(0, 3)]));
    const after = passAll(dealt);
    for (const seat of [1, 2, 3, 4]) {
      for (const card of sent[seat]) assert.ok(after.hands[receiver[seat]].some(held => sameCard(held, card)));
    }
  };
  check(1, { 1: 2, 2: 3, 3: 4, 4: 1 }); // left is the next seat, who plays next
  check(2, { 1: 4, 2: 1, 3: 2, 4: 3 });
  check(3, { 1: 3, 2: 4, 3: 1, 4: 2 });
  // No pass: play starts at once
  const hold = dealHand({ ...lobby(), handNumber: 4 }, seeded(4));
  assert.equal(hold.phase, 'play');
  assert.deepEqual(pass(hold, 1), { error: 'There is no pass this hand' });
});

test('passed cards arrive only after all four pass', () => {
  let state = lobby();
  const sent = state.hands[1].slice(0, 3);
  state = ok(pass(state, 1));
  assert.equal(state.hands[1].length, 10);
  assert.equal(state.hands[2].length, 13);
  assert.deepEqual(state.passes[1], sent);
  assert.equal(state.started, false);
  assert.deepEqual(pass(state, 1), { error: 'You have passed already' });
  // The sender sees what they sent; the receiver and the table do not
  assert.deepEqual(toPublicState(state, false, 1).myPass, sent);
  assert.deepEqual(toPublicState(state, false, 1).passed, [1]);
  for (const viewer of [2, null]) {
    const text = JSON.stringify(toPublicState(state, false, viewer));
    for (const card of sent) assert.equal(text.includes(JSON.stringify(card)), false);
  }
  for (const seat of [2, 3]) state = ok(pass(state, seat));
  assert.equal(state.hands[2].length, 10);
  state = ok(pass(state, 4));
  assert.equal(state.started, true);
  assert.equal(state.phase, 'play');
  for (const seat of [1, 2, 3, 4]) {
    assert.equal(state.hands[seat].length, 13);
    assert.deepEqual(state.hands[seat], sortHand(state.hands[seat]));
  }
  for (const card of sent) assert.ok(state.hands[2].some(held => sameCard(held, card)));
  assert.deepEqual(state.passes, {});
});

test('the 2 of clubs leads the first trick', () => {
  const state = passAll(lobby());
  const leader = state.currentPlayer ?? assert.fail('nobody to lead');
  assert.ok(state.hands[leader].some(card => sameCard(card, club('2'))));
  const other = state.hands[leader].find(card => !sameCard(card, club('2')));
  assert.deepEqual(move(state, leader, { type: 'play', card: other }), { error: 'Lead the 2 of clubs' });
  const next = ok(move(state, leader, { type: 'play', card: club('2') }));
  assert.equal(next.currentPlayer, leader % 4 + 1);
});

test('no heart or queen of spades on the first trick unless the hand has nothing else', () => {
  const first = { tricksPlayed: 0, currentPlayer: 2, trick: [{ seat: 1, card: club('2') }] };
  const state = game({ 1: [club('3')], 2: [heart('5'), QS, diamond('4')], 3: [heart('6'), QS], 4: [club('9')] }, first);
  assert.equal(playError(state.hands[2], heart('5'), state), 'No hearts or the queen of spades on the first trick');
  assert.equal(playError(state.hands[2], QS, state), 'No hearts or the queen of spades on the first trick');
  assert.equal(playError(state.hands[2], diamond('4'), state), null);
  // Only hearts and the queen: either may go
  assert.equal(playError(state.hands[3], heart('6'), state), null);
  assert.equal(playError(state.hands[3], QS, state), null);
  // After the first trick it is fine
  assert.equal(playError(state.hands[2], QS, { ...state, tricksPlayed: 1 }), null);
  assert.deepEqual(move(state, 2, { type: 'play', card: QS }), { error: 'No hearts or the queen of spades on the first trick' });
});

test('hearts cannot be led until broken unless the hand is all hearts', () => {
  const state = game({ 1: [heart('5'), QS], 2: [club('3')], 3: [club('4')], 4: [heart('9'), heart('10')] });
  assert.deepEqual(move(state, 1, { type: 'play', card: heart('5') }), { error: 'Hearts have not been broken' });
  assert.equal(playError(state.hands[1], QS, state), null);
  assert.equal(playError(state.hands[4], heart('9'), state), null);
  // A heart played off-suit breaks hearts
  const broken = playAll(game({ 1: [club('5'), heart('5')], 2: [club('3'), club('8')], 3: [club('4'), club('9')], 4: [heart('9'), diamond('10')] }),
    [club('5'), club('3'), club('4'), heart('9')]);
  assert.equal(broken.heartsBroken, true);
  assert.equal(broken.currentPlayer, 1);
  assert.equal(playError(broken.hands[1], heart('5'), broken), null);
});

test('hearts are 1 point and the queen of spades 13', () => {
  assert.equal(cardPoints(heart('2')), 1);
  assert.equal(cardPoints(heart('A')), 1);
  assert.equal(cardPoints(QS), 13);
  assert.equal(cardPoints(spade('K')), 0);
  assert.equal(standardDeck().reduce((sum, card) => sum + cardPoints(card), 0), 26);
  // The highest club takes a trick with two hearts and the queen; ace is high
  const state = playAll(game({ 1: [club('5'), club('6')], 2: [club('A'), club('7')], 3: [heart('2'), diamond('8')], 4: [QS, heart('3'), diamond('9')] }, { heartsBroken: true }),
    [club('5'), club('A'), heart('2'), QS]);
  assert.equal(state.lastTrick?.winner, 2);
  assert.deepEqual(state.taken, { 1: 0, 2: 14, 3: 0, 4: 0 });
  assert.deepEqual(state.lastMove, { type: 'play', playerNumber: 4, card: QS, trickWinner: 2 });
});

// The last trick of a hand: Bob's ace of clubs takes it with `points` in it; `taken` were taken before
function lastTrick(taken: Record<number, number>, scores: Record<number, number>, cards: PlayingCard[] = [heart('2'), heart('3')]): GameState {
  const state = game({ 1: [club('5')], 2: [club('A')], 3: [cards[0]], 4: [cards[1]] },
    { tricksPlayed: 12, heartsBroken: true, taken, scores });
  return playAll(state, [club('5'), club('A'), cards[0], cards[1]]);
}

test('a hand is scored by the points each player took', () => {
  const state = lastTrick({ 1: 13, 2: 4, 3: 2, 4: 5 }, { 1: 10, 2: 0, 3: 0, 4: 0 });
  assert.equal(state.phase, 'handOver');
  assert.equal(state.currentPlayer, null);
  assert.deepEqual(state.scores, { 1: 23, 2: 6, 3: 2, 4: 5 });
  assert.deepEqual(state.roundSummary?.change, { 1: 13, 2: 6, 3: 2, 4: 5 });
  assert.equal(state.roundSummary?.moon, null);
  assert.equal(state.isGameOver, false);
});

test('shooting the moon gives each other player 26', () => {
  const state = lastTrick({ 1: 0, 2: 24, 3: 0, 4: 0 }, { 1: 10, 2: 20, 3: 30, 4: 40 });
  assert.deepEqual(state.roundSummary?.taken, { 1: 0, 2: 26, 3: 0, 4: 0 });
  assert.deepEqual(state.roundSummary?.change, { 1: 26, 2: 0, 3: 26, 4: 26 });
  assert.deepEqual(state.scores, { 1: 36, 2: 20, 3: 56, 4: 66 });
  assert.equal(state.roundSummary?.moon, 2);
  assert.equal(state.gameStatus, 'Bob shot the moon: everyone else takes 26');
});

test('the game ends at 100 and the lowest score wins, ties share', () => {
  const short = lastTrick({ 1: 0, 2: 0, 3: 0, 4: 24 }, { 1: 50, 2: 60, 3: 70, 4: 75 }); // Dan reaches 99
  assert.equal(short.isGameOver, false);
  const won = lastTrick({ 1: 0, 2: 0, 3: 0, 4: 24 }, { 1: 50, 2: 60, 3: 70, 4: 76 });
  assert.equal(won.isGameOver, true);
  assert.equal(won.scores[4], TARGET_SCORE);
  assert.deepEqual(won.winners, [1]);
  assert.equal(won.gameStatus, 'Alice wins with 50 points!');
  assert.deepEqual(act(won, 1, { type: 'acknowledgeRound' }), { error: 'The game is over' });
  const tied = lastTrick({ 1: 0, 2: 0, 3: 0, 4: 24 }, { 1: 52, 2: 50, 3: 70, 4: 90 }); // Bob takes 2 in the last trick
  assert.deepEqual(tied.winners, [1, 2]);
  assert.equal(tied.gameStatus, 'Alice and Bob share the win with 52 points!');
});

test('Continue deals the next hand once every connected player is ready', () => {
  let state = lastTrick({ 1: 0, 2: 0, 3: 0, 4: 24 }, { 1: 0, 2: 0, 3: 0, 4: 0 });
  assert.deepEqual(move(state, 1, { type: 'play', card: club('2') }), { error: 'Not your turn' });
  for (const seat of [1, 2]) state = ok(act(state, seat, { type: 'acknowledgeRound' }));
  assert.equal(state.phase, 'handOver');
  assert.deepEqual(state.roundSummary?.acknowledged, [1, 2]);
  state = ok(act(state, 3, { type: 'acknowledgeRound' }));
  // Dan's connection drops, so the next hand does not wait for him
  state = disconnectPlayer(hearts, state, 4, seeded(1));
  assert.equal(state.phase, 'passing');
  assert.equal(state.handNumber, 2);
  assert.equal(state.gameStatus, 'Hand 2: pass three cards to the right');
  assert.equal(state.roundSummary, null);
  assert.deepEqual(state.taken, { 1: 0, 2: 0, 3: 0, 4: 0 });
  assert.equal(state.heartsBroken, false);
  assert.equal(allCards(state).length, 52);
});

test('a whole hand of legal moves scores 26 points', () => {
  for (const seed of [1, 2, 3]) {
    const state = playHand(passAll(dealHand(lobby(), seeded(seed))));
    const summary = state.roundSummary ?? assert.fail('no summary');
    const total = Object.values(summary.taken).reduce((sum, points) => sum + points, 0);
    assert.equal(total, 26);
  }
});

test('a player leaving ends the game and the lowest score so far wins', () => {
  const state = game({ 1: [club('5')], 2: [club('A')], 3: [club('6')], 4: [club('7')] },
    { scores: { 1: 40, 2: 30, 3: 30, 4: 10 }, taken: { 1: 0, 2: 0, 3: 20, 4: 0 } });
  const left = removePlayer(hearts, state, 4, seeded(1));
  assert.equal(left.isGameOver, true);
  assert.equal(left.currentPlayer, null);
  // Dan had the lowest score but left; the hand in progress is not scored
  assert.deepEqual(left.winners, [2, 3]);
  assert.equal(left.gameStatus, 'Dan left, so the game ends: Bob and Cara share the win with 30 points!');
});

test('dismissed player mid-turn', () => {
  // Dismissed while the others wait for their pass in the second hand
  let state = lastTrick({ 1: 0, 2: 0, 3: 0, 4: 0 }, { 1: 5, 2: 6, 3: 7, 4: 8 });
  for (const seat of [1, 2, 3, 4]) state = ok(act(state, seat, { type: 'acknowledgeRound' }));
  state = ok(pass(state, 1));
  const passing = removePlayer(hearts, disconnectPlayer(hearts, state, 2, seeded(1)), 2, seeded(1));
  assert.equal(passing.isGameOver, true);
  assert.deepEqual(passing.winners, [1]);
  assert.deepEqual(pass(passing, 3), { error: 'The game is over' });
  // Dismissed on their own turn in a trick
  const playing = removePlayer(hearts, game({ 1: [club('5')], 2: [club('6')], 3: [club('7')], 4: [club('8')] }), 1, seeded(1));
  assert.equal(playing.isGameOver, true);
  assert.equal(playing.currentPlayer, null);
});

test('a player leaving before the first pass completes deals afresh', () => {
  let state = ok(pass(lobby(), 1));
  state = removePlayer(hearts, state, 3, seeded(1));
  assert.equal(state.started, false);
  assert.deepEqual(state.passes, {});
  assert.equal(allCards(state).length, 0);
});

test('invalid moves', () => {
  const state = game({ 1: [club('5'), heart('5')], 2: [club('3')], 3: [club('4')], 4: [club('6')] });
  const bad: unknown[] = [
    null, 'play', 7, {}, { type: 'shout' }, { type: 'play' }, { type: 'play', card: { rank: '1', suit: 'clubs' } },
    { type: 'play', card: { rank: '5', suit: 'stars' } }, { type: 'play', card: club('K') }, { type: 'pass', cards: [0, 1, 2] }
  ];
  for (const m of bad) assert.ok('error' in move(state, 1, m), `expected an error for ${JSON.stringify(m)}`);
  assert.deepEqual(move(state, 1, { type: 'play', card: club('K') }), { error: 'You do not have that card' });
  assert.deepEqual(move(state, 2, { type: 'play', card: club('3') }), { error: 'Not your turn' });
  const following = { ...state, currentPlayer: 2, trick: [{ seat: 1, card: diamond('5') }], hands: { ...state.hands, 2: [diamond('2'), club('3')] } };
  assert.deepEqual(move(following, 2, { type: 'play', card: club('3') }), { error: 'Follow suit: play diamonds' });

  const passing = lobby();
  assert.deepEqual(move(passing, 1, { type: 'play', card: passing.hands[1][0] }), { error: 'Not your turn' });
  assert.deepEqual(move({ ...passing, started: true, currentPlayer: 1 }, 1, { type: 'play', card: passing.hands[1][0] }),
    { error: 'Pass three cards first' });
  for (const cards of [[0, 1], [0, 1, 2, 3], [0, 0, 1], [0, 1, 13], [0, 1, -1], [0, 1, 1.5], ['0', 1, 2], 'all', null]) {
    assert.ok('error' in (pass(passing, 1, cards) ?? assert.fail()), `expected an error for ${JSON.stringify(cards)}`);
  }
  assert.deepEqual(pass(lobby(3), 1), { error: 'Waiting for more players' });
  assert.deepEqual(pass(passing, 9), { error: 'You are not in this game' });
  assert.deepEqual(pass(state, 1), { error: 'The pass is over' });
  assert.deepEqual(pass({ ...passing, undoVote: { requestedBy: 1, votes: {} } }, 1), { error: 'An undo vote is in progress' });
  assert.deepEqual(act(state, 1, { type: 'acknowledgeRound' }), { error: 'Nothing to continue' });
  assert.deepEqual(act(state, 1, { type: 'other' }), { error: 'Unknown action' });
  assert.equal(passing.hands[1].length, 13); // nothing above changed the state
});

test('table view hides hands', () => {
  // Every step of a short hand: the deal, each pass and the first tricks
  let state = lobby();
  const steps: GameState[] = [state];
  for (const seat of [1, 2, 3, 4]) steps.push(state = ok(pass(state, seat)));
  for (let i = 0; i < 9; i++) {
    const seat = state.currentPlayer ?? assert.fail('nobody to play');
    const card = state.hands[seat].find(held => playError(state.hands[seat], held, state) === null);
    steps.push(state = ok(move(state, seat, { type: 'play', card })));
  }
  for (const step of steps) {
    const table = toPublicState(step, false, null);
    const text = JSON.stringify(table);
    assert.deepEqual(table.hand, []);
    assert.deepEqual(table.myPass, []);
    for (const key of ['hands', 'passes']) assert.equal(key in table, false);
    const shown = [...step.trick, ...(step.lastTrick?.plays ?? [])].map(play => JSON.stringify(play.card));
    for (const card of allCards(step)) {
      if (!shown.includes(JSON.stringify(card))) assert.equal(text.includes(JSON.stringify(card)), false);
    }
    for (const seat of [1, 2, 3, 4]) {
      const own = toPublicState(step, false, seat);
      assert.deepEqual(own.hand, step.hands[seat]);
      assert.deepEqual(own.myPass, step.passes[seat] ?? []);
      assert.equal(own.handCounts[seat], step.hands[seat].length);
    }
  }
});

test('describes plays for the status line', () => {
  const state = playAll(game({ 1: [club('5')], 2: [club('6')], 3: [club('7')], 4: [club('8')] }), [club('5')]);
  assert.equal(state.gameStatus, 'Alice played 5 of clubs');
});
