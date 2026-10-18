import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASES,
  createDeck,
  phaseName,
  cardPoints,
  buildGroup,
  extendGroup,
  skipTargets,
  toPublicState,
  acknowledgeHand,
  createGameState,
  resetLobby,
  onPlayerLeft
} from './rules.ts';
import { phase10 } from './index.ts';
import { applyMove, removePlayer } from '../../shared/seating.ts';
import type { Card, CardColor, GameState, Group, Result } from './types.ts';

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
const num = (value: number, cardColor: CardColor = 'red'): Card => ({ id: nextId++, kind: 'number', value, color: cardColor });
const wild = (): Card => ({ id: nextId++, kind: 'wild' });
const skip = (): Card => ({ id: nextId++, kind: 'skip' });
const ids = (cards: Card[]) => cards.map(card => card.id);

function ok<T>(result: Result<T>): T {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Alice to play, with the hands, piles and phases given
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g1'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2],
    playerNames: { 1: 'Alice', 2: 'Bob' },
    dealer: 2,
    hands: { 1: [num(1)], 2: [num(2)] },
    drawPile: [num(3), num(4)],
    discardPile: [num(5)],
    phases: { 1: 1, 2: 1 },
    scores: { 1: 0, 2: 0 },
    ...overrides
  };
}

const move = (state: GameState, seat: number, input: unknown, random = seeded(1)) =>
  applyMove(phase10, state, seat, input, random);
const drawPile = { type: 'draw', source: 'pile' };
const drawDiscard = { type: 'draw', source: 'discard' };
const discardOf = (card: Card, skipSeat: number | null = null) => ({ type: 'discard', card: card.id, skip: skipSeat });

test('the deck has 96 numbers, 8 wilds and 4 skips, each with its own id', () => {
  const deck = createDeck();
  assert.equal(deck.length, 108);
  assert.equal(new Set(ids(deck)).size, 108);
  assert.equal(deck.filter(card => card.kind === 'wild').length, 8);
  assert.equal(deck.filter(card => card.kind === 'skip').length, 4);
  const redSevens = deck.filter(card => card.kind === 'number' && card.color === 'red' && card.value === 7);
  assert.equal(redSevens.length, 2);
});

test('phases are named from their parts', () => {
  assert.equal(PHASES.length, 10);
  assert.equal(phaseName(1), '2 sets of 3');
  assert.equal(phaseName(2), '1 set of 3 + 1 run of 4');
  assert.equal(phaseName(4), '1 run of 7');
  assert.equal(phaseName(8), '7 cards of one color');
  assert.equal(phaseName(10), '1 set of 5 + 1 set of 3');
});

test('cards left in hand cost 5, 10, 15 or 25 points', () => {
  assert.deepEqual([num(1), num(9), num(10), num(12), skip(), wild()].map(cardPoints), [5, 5, 10, 10, 15, 25]);
});

test('a set needs one number, wilds allowed', () => {
  const cards = [num(7), wild(), num(7, 'blue')];
  assert.deepEqual(buildGroup(1, { kind: 'set', size: 3 }, cards), { owner: 1, kind: 'set', value: 7, cards });
  assert.equal(buildGroup(1, { kind: 'set', size: 3 }, [num(7), num(8), num(7)]), null);
  assert.equal(buildGroup(1, { kind: 'set', size: 3 }, [wild(), wild(), wild()]), null);
  assert.equal(buildGroup(1, { kind: 'set', size: 3 }, [num(7), num(7), skip()]), null);
  assert.equal(buildGroup(1, { kind: 'set', size: 3 }, [num(7), num(7)]), null);
});

test('a run is put in order, wilds filling the gaps and then the top', () => {
  const [three, five, w1, w2] = [num(3), num(5), wild(), wild()];
  const group = buildGroup(1, { kind: 'run', size: 4 }, [five, w1, three, w2]);
  assert.deepEqual(group, { owner: 1, kind: 'run', start: 3, cards: [three, w1, five, w2] });

  const [eleven, twelve, w3] = [num(11), num(12), wild()];
  const top = buildGroup(1, { kind: 'run', size: 3 }, [twelve, w3, eleven]);
  assert.deepEqual(top, { owner: 1, kind: 'run', start: 10, cards: [w3, eleven, twelve] });

  assert.equal(buildGroup(1, { kind: 'run', size: 4 }, [num(3), num(3), num(4), num(5)]), null);
  assert.equal(buildGroup(1, { kind: 'run', size: 4 }, [num(3), num(4), num(5), num(8)]), null);
  assert.equal(buildGroup(1, { kind: 'run', size: 4 }, [wild(), wild(), wild(), wild()]), null);
});

test('a color group takes any numbers of one color, and wilds', () => {
  const cards = [num(1, 'green'), num(5, 'green'), num(5, 'green'), wild(), num(12, 'green'), num(9, 'green'), num(2, 'green')];
  assert.equal(buildGroup(1, { kind: 'color', size: 7 }, cards)?.kind, 'color');
  assert.equal(buildGroup(1, { kind: 'color', size: 7 }, [...cards.slice(1), num(3, 'blue')]), null);
});

test('hits extend a set or color group with matching cards', () => {
  const setGroup: Group = { owner: 1, kind: 'set', value: 4, cards: [num(4), num(4), num(4)] };
  assert.equal(extendGroup(setGroup, [num(4, 'blue'), wild()])?.cards.length, 5);
  assert.equal(extendGroup(setGroup, [num(5)]), null);
  assert.equal(extendGroup(setGroup, [skip()]), null);
  assert.equal(extendGroup(setGroup, []), null);

  const colorGroup: Group = { owner: 1, kind: 'color', color: 'blue', cards: [num(1, 'blue')] };
  assert.equal(extendGroup(colorGroup, [num(9, 'blue')])?.cards.length, 2);
  assert.equal(extendGroup(colorGroup, [num(9, 'red')]), null);
});

test('hits extend a run at either end, up to 1 and 12', () => {
  const runGroup: Group = { owner: 1, kind: 'run', start: 5, cards: [num(5), num(6), num(7), num(8)] };
  const [four, nine, ten] = [num(4), num(9), num(10)];
  const both = extendGroup(runGroup, [ten, four, nine]);
  assert.equal(both?.kind === 'run' && both.start, 4);
  assert.deepEqual(both?.cards.map(card => card.id), [four.id, ...ids(runGroup.cards), nine.id, ten.id]);
  assert.equal(extendGroup(runGroup, [num(11)]), null);

  // A wild goes below when a waiting card needs it there, or when the run already reaches 12
  const three = num(3);
  const lower = extendGroup(runGroup, [wild(), three]);
  assert.equal(lower?.kind === 'run' && lower.start, 3);
  const full: Group = { owner: 1, kind: 'run', start: 9, cards: [num(9), num(10), num(11), num(12)] };
  const below = extendGroup(full, [wild()]);
  assert.equal(below?.kind === 'run' && below.start, 8);
  const all: Group = { owner: 1, kind: 'run', start: 1, cards: Array.from({ length: 12 }, (_, index) => num(index + 1)) };
  assert.equal(extendGroup(all, [wild()]), null);
});

test('the lobby deals ten cards each and starts the discard pile', () => {
  const lobby = resetLobby({ ...createGameState('g1'), activePlayers: [1, 2, 3], currentPlayer: 1 }, seeded(7));
  assert.deepEqual(Object.values(lobby.hands).map(hand => hand.length), [10, 10, 10]);
  assert.equal(lobby.discardPile.length, 1);
  assert.equal(lobby.drawPile.length, 108 - 31);
  assert.equal(lobby.dealer, 3);
  assert.deepEqual(lobby.phases, { 1: 1, 2: 1, 3: 1 });
  const all = [...Object.values(lobby.hands).flat(), ...lobby.drawPile, ...lobby.discardPile];
  assert.equal(new Set(ids(all)).size, 108);

  const alone = resetLobby({ ...createGameState('g1'), activePlayers: [1], currentPlayer: 1 }, seeded(7));
  assert.deepEqual(alone.hands, {});
  assert.equal(alone.dealer, null);
});

test('a turn is a draw, then a discard; the turn passes only on the discard', () => {
  const state = game();
  assert.deepEqual(move(state, 1, discardOf(state.hands[1][0])), { error: 'Draw a card first' });

  const drawn = ok(move(state, 1, drawPile));
  assert.equal(drawn.currentPlayer, 1);
  assert.deepEqual(ids(drawn.hands[1]), [...ids(state.hands[1]), state.drawPile[1].id]);
  assert.equal(drawn.drawPile.length, 1);
  assert.deepEqual(drawn.lastMove, { playerNumber: 1, type: 'draw', source: 'pile' });
  assert.equal(drawn.gameStatus, 'Alice drew from the pile');
  assert.deepEqual(move(drawn, 1, drawDiscard), { error: 'You have already drawn this turn' });

  const discarded = ok(move(drawn, 1, discardOf(drawn.hands[1][0])));
  assert.equal(discarded.currentPlayer, 2);
  assert.equal(discarded.drawnBy, null);
  assert.equal(discarded.discardPile.at(-1)?.id, state.hands[1][0].id);
  assert.equal(discarded.gameStatus, 'Alice discarded a red 1');
  assert.deepEqual(move(discarded, 1, drawPile), { error: 'Not your turn' });
});

test('the discard top can be taken, except a Skip', () => {
  const state = game();
  const taken = ok(move(state, 1, drawDiscard));
  assert.equal(taken.hands[1].at(-1)?.id, state.discardPile[0].id);
  assert.deepEqual(taken.discardPile, []);
  assert.equal(taken.gameStatus, 'Alice took the red 5 from the discard pile');
  assert.deepEqual(move(game({ discardPile: [skip()] }), 1, drawDiscard), { error: 'A Skip cannot be picked up' });
  assert.deepEqual(move(game({ discardPile: [] }), 1, drawDiscard), { error: 'The discard pile is empty' });
});

test('an empty draw pile is reshuffled from the discards under the top card', () => {
  const discards = [num(6), num(7), num(8)];
  const state = game({ drawPile: [], discardPile: discards });
  const drawn = ok(move(state, 1, drawPile));
  assert.equal(drawn.drawPile.length, 1);
  assert.deepEqual(ids(drawn.discardPile), [discards[2].id]);
  assert.deepEqual(new Set([...ids(drawn.drawPile), drawn.hands[1].at(-1)?.id]), new Set(ids(discards.slice(0, 2))));
  assert.deepEqual(move(game({ drawPile: [], discardPile: [num(1)] }), 1, drawPile), { error: 'There are no cards left to draw' });
});

// Alice holds phase 1 (two sets of 3) and two more cards, and has drawn
function readyToLayDown() {
  const sevens = [num(7), num(7, 'blue'), wild()];
  const twos = [num(2), num(2, 'green'), num(2, 'yellow')];
  const extra = [num(7, 'green'), num(11)];
  const state = game({ hands: { 1: [...sevens, ...twos, ...extra], 2: [num(1)] }, drawnBy: 1 });
  return { state, sevens, twos, extra };
}

test('laying down a phase puts its groups on the table, once per hand', () => {
  const { state, sevens, twos, extra } = readyToLayDown();
  const laid = ok(move(state, 1, { type: 'layDown', groups: [ids(sevens), ids(twos)] }));
  assert.deepEqual(laid.groups.map(group => group.kind === 'set' && group.value), [7, 2]);
  assert.deepEqual(ids(laid.hands[1]), ids(extra));
  assert.equal(laid.currentPlayer, 1);
  assert.equal(laid.gameStatus, 'Alice laid down phase 1');
  assert.deepEqual(move(laid, 1, { type: 'layDown', groups: [ids(sevens), ids(twos)] }),
    { error: 'You have already laid down your phase this hand' });
});

test('a lay down must use the exact cards of the current phase', () => {
  const { state, sevens, twos, extra } = readyToLayDown();
  const layDown = (groups: number[][]) => move(state, 1, { type: 'layDown', groups });
  assert.deepEqual(layDown([ids(sevens)]), { error: 'Phase 1 needs 2 sets of 3' });
  assert.deepEqual(layDown([ids(sevens), [...ids(twos.slice(0, 2)), extra[1].id]]), { error: 'Group 2 is not a set of 3' });
  assert.deepEqual(layDown([ids(sevens), [...ids(twos), extra[0].id]]), { error: 'Group 2 is not a set of 3' });
  assert.deepEqual(layDown([ids(sevens), ids(sevens)]), { error: 'Those cards are not in your hand' });
  assert.deepEqual(layDown([ids(sevens), [twos[0].id, twos[1].id, 99999]]), { error: 'Those cards are not in your hand' });
  assert.deepEqual(move(game({ ...state, phases: { 1: 4, 2: 1 } }), 1, { type: 'layDown', groups: [ids(sevens), ids(twos)] }),
    { error: 'Phase 4 needs 1 run of 7' });
});

test('hitting needs your own phase down, and may go on anyone\'s group', () => {
  const { state, sevens, twos, extra } = readyToLayDown();
  const bobsRun: Group = { owner: 2, kind: 'run', start: 8, cards: [num(8), num(9), num(10)] };
  const withRun = { ...state, groups: [bobsRun] };
  assert.deepEqual(move(withRun, 1, { type: 'hit', group: 0, cards: [extra[1].id] }), { error: 'Lay down your own phase before hitting' });

  const laid = ok(move(withRun, 1, { type: 'layDown', groups: [ids(sevens), ids(twos)] }));
  const onRun = ok(move(laid, 1, { type: 'hit', group: 0, cards: [extra[1].id] }));
  assert.equal(onRun.groups[0].cards.length, 4);
  assert.equal(onRun.gameStatus, 'Alice hit 1 card on Bob\'s run');
  assert.deepEqual(move(laid, 1, { type: 'hit', group: 2, cards: [extra[1].id] }), { error: 'Those cards do not fit that group' });
  assert.deepEqual(move(laid, 1, { type: 'hit', group: 9, cards: [extra[1].id] }), { error: 'There is no such group' });
  assert.deepEqual(move(laid, 1, { type: 'hit', group: 1, cards: [] }), { error: 'Those cards are not in your hand' });
});

test('a Skip makes the chosen player lose their next turn', () => {
  const card = skip();
  const state = game({
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cy' },
    hands: { 1: [card, num(1)], 2: [num(2)], 3: [num(3)] },
    phases: { 1: 1, 2: 1, 3: 1 },
    scores: { 1: 0, 2: 0, 3: 0 },
    drawnBy: 1
  });
  assert.deepEqual(skipTargets(state, 1), [2, 3]);
  assert.deepEqual(move(state, 1, discardOf(card)), { error: 'Choose a player to skip' });
  assert.deepEqual(move(state, 1, discardOf(card, 1)), { error: 'Choose a player to skip' });

  const skipped = ok(move(state, 1, discardOf(card, 2)));
  assert.equal(skipped.currentPlayer, 3);
  assert.deepEqual(skipped.skipped, []);
  assert.equal(skipped.gameStatus, 'Alice discarded a Skip on Bob');

  // A player already waiting to be skipped cannot be chosen again
  const waiting = ok(move(state, 1, discardOf(card, 3)));
  assert.equal(waiting.currentPlayer, 2);
  assert.deepEqual(waiting.skipped, [3]);
  assert.deepEqual(skipTargets(waiting, 2), [1]);
});

test('with two players, a Skip gives the discarder another turn', () => {
  const card = skip();
  const state = game({ hands: { 1: [card, num(1)], 2: [num(2)] }, drawnBy: 1 });
  const again = ok(move(state, 1, discardOf(card, 2)));
  assert.equal(again.currentPlayer, 1);
  assert.equal(again.drawnBy, null);
});

// Alice has laid down phase 1 and holds one card; Bob holds a wild and a 12
function aboutToGoOut(phases = { 1: 1, 2: 1 }) {
  const last = num(9);
  const state = game({
    hands: { 1: [last], 2: [wild(), num(12)] },
    groups: [{ owner: 1, kind: 'set', value: 9, cards: [num(9), num(9), num(9)] }],
    phases,
    scores: { 1: 10, 2: 20 },
    drawnBy: 1
  });
  return { state, last };
}

test('discarding the last card ends the hand: cards left are scored and players who laid down move on', () => {
  const { state, last } = aboutToGoOut();
  const scored = ok(move(state, 1, discardOf(last)));
  assert.equal(scored.currentPlayer, null);
  assert.deepEqual(scored.phases, { 1: 2, 2: 1 });
  assert.deepEqual(scored.scores, { 1: 10, 2: 55 });
  assert.equal(scored.isGameOver, false);
  assert.deepEqual(scored.handSummary, {
    handNumber: 1,
    wentOut: 1,
    acknowledged: [],
    seats: {
      1: { phase: 1, completed: true, cardsLeft: 0, points: 0, scoreAfter: 10 },
      2: { phase: 1, completed: false, cardsLeft: 2, points: 35, scoreAfter: 55 }
    }
  });
  assert.equal(scored.gameStatus, 'Alice went out. Hand 1 scored. Waiting for everyone to continue.');
  assert.deepEqual(move(scored, 1, drawPile), { error: 'Not your turn' });
});

test('hitting the last card also goes out', () => {
  const { state, last } = aboutToGoOut();
  const scored = ok(move(state, 1, { type: 'hit', group: 0, cards: [last.id] }));
  assert.equal(scored.handSummary?.wentOut, 1);
  assert.deepEqual(scored.phases, { 1: 2, 2: 1 });
});

test('the next hand is dealt once everyone has continued, and the deal moves on a seat', () => {
  const { state, last } = aboutToGoOut();
  const scored = ok(move(state, 1, discardOf(last)));
  assert.deepEqual(acknowledgeHand(state, 1), { error: 'Nothing to continue' });

  const one = ok(acknowledgeHand(scored, 2, seeded(3)));
  assert.deepEqual(one.handSummary?.acknowledged, [2]);
  assert.equal(one.gameStatus, 'Bob is ready for the next hand');
  assert.equal(ok(acknowledgeHand(one, 2)), one);
  assert.deepEqual(acknowledgeHand({ ...one, undoVote: { requestedBy: 1, votes: {} } }, 1), { error: 'An undo vote is in progress' });

  const next = ok(acknowledgeHand(one, 1, seeded(4)));
  assert.equal(next.handSummary, null);
  assert.equal(next.handNumber, 2);
  assert.equal(next.dealer, 1);
  assert.equal(next.currentPlayer, 2);
  assert.deepEqual(next.groups, []);
  assert.deepEqual(Object.values(next.hands).map(hand => hand.length), [10, 10]);
  assert.equal(next.gameStatus, 'Bob starts hand 2.');
});

test('a disconnected or departed player is not waited for', () => {
  const { state, last } = aboutToGoOut();
  const scored = ok(move(state, 1, discardOf(last)));
  const acked = ok(acknowledgeHand({ ...scored, disconnected: [2] }, 1, seeded(3)));
  assert.equal(acked.handNumber, 2);

  const one = ok(acknowledgeHand(scored, 1));
  const left = onPlayerLeft({ ...one, activePlayers: [1, 3], playerNames: { ...one.playerNames, 3: 'Cy' } }, 2, seeded(3));
  assert.equal(left.handNumber, 1); // Cy has not continued yet
  const both = onPlayerLeft({ ...one, activePlayers: [1] }, 2, seeded(3));
  assert.equal(both.handNumber, 2);
});

test('the game ends after a hand in which someone completes phase 10; the lowest score among them wins', () => {
  const { state, last } = aboutToGoOut({ 1: 10, 2: 10 });
  const ended = ok(move(state, 1, discardOf(last)));
  assert.equal(ended.isGameOver, true);
  assert.deepEqual(ended.winners, [1]);
  assert.equal(ended.gameStatus, 'Alice wins with 10 points!');
  assert.deepEqual(acknowledgeHand(ended, 1), { error: 'Nothing to continue' });

  // Bob also completed phase 10 and has the lower score
  const bobs: Group = { owner: 2, kind: 'set', value: 1, cards: [num(1), num(1), num(1)] };
  const both = ok(move({ ...state, groups: [...state.groups, bobs], hands: { 1: [last], 2: [] }, scores: { 1: 30, 2: 20 } }, 1, discardOf(last)));
  assert.deepEqual(both.winners, [2]);

});

// Alice, Bob and Cy: Alice goes out on phase 10 with Bob, tying him on 20 points; Cy is far behind
function tiedOnPhase10() {
  const last = num(9);
  const state = game({
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cy' },
    dealer: 3,
    hands: { 1: [last], 2: [], 3: [num(4)] },
    groups: [
      { owner: 1, kind: 'set', value: 9, cards: [num(9), num(9), num(9)] },
      { owner: 2, kind: 'set', value: 1, cards: [num(1), num(1), num(1)] }
    ],
    phases: { 1: 10, 2: 10, 3: 4 },
    scores: { 1: 20, 2: 20, 3: 90 },
    drawnBy: 1
  });
  return ok(move(state, 1, discardOf(last)));
}

test('a tie for the lowest score on phase 10 is settled by a tiebreaker hand of phase 10', () => {
  const tied = tiedOnPhase10();
  assert.equal(tied.isGameOver, false);
  assert.deepEqual(tied.winners, []);
  assert.deepEqual(tied.tiebreak, [1, 2]);
  assert.deepEqual(tied.phases, { 1: 10, 2: 10, 3: 4 });
  assert.equal(tied.gameStatus, 'Alice and Bob tie with 20 points, so they play a tiebreaker hand of phase 10. Waiting for everyone to continue.');

  // Only the tied players are dealt in, and the turn passes between them alone
  const all = [1, 2, 3].reduce((state, seat) => ok(acknowledgeHand(state, seat, seeded(4))), tied);
  assert.equal(all.handNumber, 2);
  assert.deepEqual(Object.keys(all.hands), ['1', '2']);
  assert.equal(all.dealer, 1);
  assert.equal(all.currentPlayer, 2);
  assert.match(all.gameStatus, /Bob starts the tiebreaker, hand 2\./);
  assert.deepEqual(skipTargets(all, 2), [1]);
  const drawn = ok(move(all, 2, drawPile));
  const card = drawn.hands[2].find(candidate => candidate.kind === 'number');
  assert.ok(card);
  assert.equal(ok(move(drawn, 2, discardOf(card))).currentPlayer, 1);
});

test('in the tiebreaker the tied player who completes phase 10 wins; otherwise another tiebreaker follows', () => {
  const tied = tiedOnPhase10();
  // Bob discards his last card in the tiebreaker hand
  const bobGoesOut = (groups: Group[], aliceHand: Card[]) => {
    const last = num(9);
    const state: GameState = {
      ...tied,
      handSummary: null,
      currentPlayer: 2,
      drawnBy: 2,
      hands: { 1: aliceHand, 2: [last] },
      groups
    };
    return ok(move(state, 2, discardOf(last)));
  };
  const bobs: Group = { owner: 2, kind: 'set', value: 9, cards: [num(9), num(9), num(9)] };
  const alices: Group = { owner: 1, kind: 'set', value: 5, cards: [num(5), num(5), num(5)] };

  const won = bobGoesOut([bobs], [num(5), wild()]);
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [2]);
  assert.equal(won.gameStatus, 'Bob wins with 20 points!');
  assert.deepEqual(Object.keys(won.handSummary?.seats ?? {}), ['1', '2']);

  // Both complete it with nothing left over: still tied, so they play again
  const again = bobGoesOut([alices, bobs], []);
  assert.equal(again.isGameOver, false);
  assert.deepEqual(again.tiebreak, [1, 2]);
  assert.deepEqual(again.phases, { 1: 10, 2: 10, 3: 4 });
});

test('a player dismissed on their turn passes it on past a player due to be skipped', () => {
  const state = game({
    currentPlayer: 2, activePlayers: [1, 2, 3], playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cy' },
    hands: { 1: [num(1)], 2: [num(2)], 3: [num(3)] }, phases: { 1: 1, 2: 1, 3: 1 }, scores: { 1: 0, 2: 0, 3: 0 }, skipped: [3]
  });
  const next = removePlayer(phase10, state, 2, seeded(3));
  assert.equal(next.currentPlayer, 1);
  assert.deepEqual(next.skipped, []);
});

test('if all but one tied player leaves, the one left wins the tiebreaker', () => {
  const tied = tiedOnPhase10();
  const left = onPlayerLeft({ ...tied, activePlayers: [1, 3] }, 2, seeded(3));
  assert.equal(left.isGameOver, true);
  assert.deepEqual(left.winners, [1]);
  assert.equal(left.gameStatus, 'Alice wins! Everyone else in the tiebreaker left.');

  // A player outside the tiebreaker leaving changes nothing for it, and the turn stays with the tied players
  const midHand = { ...tied, handSummary: null, activePlayers: [1, 2], currentPlayer: 3 };
  const outsider = onPlayerLeft(midHand, 3, seeded(3));
  assert.equal(outsider.isGameOver, false);
  assert.equal(outsider.currentPlayer, 1);
});

// The first seed whose deal turns up a Skip to start the discard pile
function skipSeed(deal: (random: () => number) => GameState): number {
  const seed = Array.from({ length: 1000 }, (_, n) => n).find(n => deal(seeded(n)).discardPile[0].kind === 'skip');
  assert.ok(seed !== undefined);
  return seed;
}

test('a Skip turned up to start the discard pile skips the first player', () => {
  const lobby = (random: () => number) => resetLobby({
    ...createGameState('g1'),
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cy' },
    currentPlayer: 1,
    gameStatus: 'Cy joined (3/6 players)'
  }, random);
  const opened = lobby(seeded(skipSeed(lobby)));
  assert.equal(opened.currentPlayer, 2);
  assert.equal(opened.gameStatus, 'Cy joined (3/6 players). The first discard is a Skip, so Alice is skipped.');
  assert.deepEqual(opened.skipped, []);

  const { state, last } = aboutToGoOut();
  const scored = ok(move(state, 1, discardOf(last)));
  const nextHand = (random: () => number) => ok(acknowledgeHand(ok(acknowledgeHand(scored, 1)), 2, random));
  const skippedStart = nextHand(seeded(skipSeed(nextHand)));
  assert.equal(skippedStart.dealer, 1);
  assert.equal(skippedStart.currentPlayer, 1);
  assert.equal(skippedStart.gameStatus, 'The first discard is a Skip, so Bob is skipped. Alice starts hand 2.');
});

test('a player sees only their own hand; the history sees none', () => {
  const state = game();
  const alice = toPublicState(state, false, 1);
  assert.deepEqual(alice.myHand, state.hands[1]);
  assert.deepEqual(alice.handCounts, { 1: 1, 2: 1 });
  assert.equal(alice.drawCount, 2);
  assert.deepEqual(alice.discardTop, state.discardPile[0]);
  assert.equal('hands' in alice, false);
  assert.equal('drawPile' in alice, false);
  assert.equal('discardPile' in alice, false);
  assert.deepEqual(toPublicState(state, false, 2).myHand, state.hands[2]);
  assert.deepEqual(toPublicState(state, false, null).myHand, []);
});

test('malformed moves are refused', () => {
  const state = game({ drawnBy: 1 });
  const malformed: unknown[] = [
    null,
    'draw',
    {},
    { type: 'draw', source: 'deck' },
    { type: 'layDown', groups: 'all' },
    { type: 'layDown', groups: [[1.5]] },
    { type: 'hit', group: '0', cards: [1] },
    { type: 'hit', group: 0, cards: 'x' },
    { type: 'discard', card: '1' },
    { type: 'discard', card: 1, skip: 'Bob' },
    { type: 'pass' }
  ];
  for (const input of malformed) {
    assert.deepEqual(move(state, 1, input), { error: 'Invalid move' }, JSON.stringify(input));
  }
  assert.deepEqual(move(state, 1, { type: 'discard', card: 99999, skip: null }), { error: 'That card is not in your hand' });
});
