import { finalStandings } from './rules.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRules } from '../../server/testing.ts';
import {
  buildDeck, canPlay, cardName, cardPoints, createGameState, cutForDealer, dealRound, handPoints, sameCard, stepFrom,
  targetScore, toPublicState
} from './rules.ts';
import { uno } from './index.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import type { Random } from '../../shared/types.ts';
import type { Card, Color, GameState, Result, Value } from './types.ts';

const card = (color: Color | 'wild', value: Value): Card => ({ color, value });
const red = (value: Value) => card('red', value);
const blue = (value: Value) => card('blue', value);
const WILD = card('wild', 'wild');
const WILD_FOUR = card('wild', 'wildDrawFour');

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

// Makes the next shuffle of a full deck end with `top` (its first card on top), then acts as `then`.
// Fisher-Yates swaps index i with floor(random * (i + 1)), from the end down.
function stacked(top: Card[], then: Random = noShuffle): Random {
  const deck = buildDeck();
  const picks = top.map((wanted, k) => {
    const i = deck.length - 1 - k;
    const j = deck.findIndex((held, index) => index <= i && sameCard(held, wanted));
    [deck[i], deck[j]] = [deck[j], deck[i]];
    return (j + 0.5) / (i + 1);
  });
  let call = 0;
  return () => (call < picks.length ? picks[call++] : then());
}

function lobby(...names: string[]): GameState {
  let state = createGameState('g');
  for (const name of names) {
    const result = addPlayer(uno, state, name, seeded(names.length));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

function countCards(state: GameState): number {
  return state.drawPile.length + state.discardPile.length + Object.values(state.hands).flat().length;
}

// A three-player game under way: the top card is a red 5, and every hand is small and known
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    turnHolder: 1,
    activePlayers: [1, 2, 3],
    playerNames: { 1: 'Alice', 2: 'Bob', 3: 'Cara' },
    dealer: 3,
    scores: { 1: 0, 2: 0, 3: 0 },
    hands: { 1: [red('7'), blue('5'), blue('9')], 2: [blue('1'), blue('2')], 3: [blue('3'), blue('4')] },
    drawPile: [blue('6'), blue('7'), blue('8'), red('8')],
    discardPile: [red('5')],
    currentColor: 'red',
    ...overrides
  };
}

const withHand = (seat: number, hand: Card[], overrides: Partial<GameState> = {}) =>
  game({ hands: { ...game().hands, [seat]: hand }, ...overrides });

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const move = (state: GameState, seat: number, made: object, random: Random = noShuffle) =>
  applyMove(uno, state, seat, made, random);
const play = (state: GameState, seat: number, played: Card, color?: Color, uno?: boolean) =>
  move(state, seat, { type: 'play', card: played, color, uno });
const draw = (state: GameState, seat: number) => move(state, seat, { type: 'draw' });
const pass = (state: GameState, seat: number) => move(state, seat, { type: 'pass' });
const act = (state: GameState, seat: number, type: string, random: Random = noShuffle) =>
  uno.applyAction?.(state, seat, { type }, random) ?? assert.fail('UNO has actions');

test('the deck has the standard 108 cards', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 108);
  assert.equal(deck.filter(c => c.color === 'red').length, 25);
  assert.equal(deck.filter(c => c.color === 'red' && c.value === '0').length, 1);
  assert.equal(deck.filter(c => c.color === 'red' && c.value === '7').length, 2);
  assert.equal(deck.filter(c => c.color === 'green' && c.value === 'drawTwo').length, 2);
  assert.equal(deck.filter(c => c.value === 'wild').length, 4);
  assert.equal(deck.filter(c => c.value === 'wildDrawFour').length, 4);
});

test('a card plays on a matching color, number or symbol, and a Wild on anything', () => {
  assert.equal(canPlay(red('2'), blue('5'), 'red'), true);
  assert.equal(canPlay(blue('5'), red('5'), 'red'), true);
  assert.equal(canPlay(blue('skip'), red('skip'), 'red'), true);
  assert.equal(canPlay(blue('6'), red('5'), 'red'), false);
  assert.equal(canPlay(WILD_FOUR, red('5'), 'red'), true);
  // After a Wild only the chosen color matches
  assert.equal(canPlay(blue('6'), WILD, 'green'), false);
  assert.equal(canPlay(card('green', '6'), WILD, 'green'), true);
});

test('cards are named for the status line', () => {
  assert.equal(cardName(red('7')), 'red 7');
  assert.equal(cardName(blue('drawTwo')), 'blue Draw Two');
  assert.equal(cardName(WILD_FOUR), 'Wild Draw Four');
});

test('cards score their face value, 20 for an action card and 50 for a Wild', () => {
  assert.equal(cardPoints(red('0')), 0);
  assert.equal(cardPoints(red('7')), 7);
  for (const value of ['skip', 'reverse', 'drawTwo'] as Value[]) assert.equal(cardPoints(blue(value)), 20);
  assert.equal(cardPoints(WILD), 50);
  assert.equal(cardPoints(WILD_FOUR), 50);
  assert.equal(handPoints([red('9'), blue('skip'), WILD]), 79);
});

test('turns step through the seats either way and wrap around', () => {
  assert.equal(stepFrom([1, 2, 4], 2, 1), 4);
  assert.equal(stepFrom([1, 2, 4], 4, 1), 1);
  assert.equal(stepFrom([1, 2, 4], 1, -1), 4);
  assert.equal(stepFrom([1, 2, 4], 3, -1), 2); // from a seat that has left
});

test('one player waits with no cards dealt', () => {
  const state = lobby('Alice');
  assert.deepEqual(state.hands, { 1: [] });
  assert.deepEqual(state.discardPile, []);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.dealer, null);
});

test('seven cards each are dealt and a starting card flipped, afresh whenever the lobby changes', () => {
  const two = lobby('Alice', 'Bob');
  assert.equal(two.hands[1].length, 7);
  assert.equal(two.hands[2].length, 7);
  assert.equal(two.discardPile.length, 1);
  assert.equal(countCards(two), 108);
  assert.equal(two.gameStatus, 'Bob joined (2/8 players)');
  assert.deepEqual(two.scores, { 1: 0, 2: 0 });
  assert.equal(two.roundNumber, 1);

  const three = lobby('A', 'B', 'C');
  assert.equal(countCards(three), 108);
  const left = removePlayer(uno, three, 2, seeded(3));
  assert.deepEqual(Object.keys(left.hands), ['1', '3']);
  assert.equal(countCards(left), 108);
  assert.equal(left.started, false);
});

test('each player draws a card and the highest number deals; ties draw again', () => {
  assert.equal(cutForDealer([1, 2], stacked([red('3'), red('9')])), 2);
  assert.equal(cutForDealer([1, 2], stacked([red('9'), blue('9'), red('5'), card('green', '2')])), 1);
  // A card that is not a number counts lowest, below a 0
  assert.equal(cutForDealer([1, 2], stacked([red('skip'), red('0')])), 2);
  assert.equal(cutForDealer([1, 2], stacked([WILD, red('0')])), 2);
  // Only the tied players draw again
  assert.equal(cutForDealer([1, 2, 3], stacked([red('7'), blue('7'), red('2'), red('1'), red('4')])), 2);

  const state = uno.resetLobby(lobby('A', 'B', 'C'), stacked([red('2'), red('9'), red('5')], seeded(4)));
  assert.equal(state.dealer, 2);
  assert.equal(countCards(state), 108);
});

// Deals for three players (or `players`) with `starter` flipped, the rest of the deck in order
function startWith(starter: Card, dealer = 2, players = 3): GameState {
  const activePlayers = Array.from({ length: players }, (_, i) => i + 1);
  const state = {
    ...createGameState('g'),
    activePlayers,
    playerNames: Object.fromEntries(activePlayers.map(seat => [seat, `P${seat}`])),
    scores: Object.fromEntries(activePlayers.map(seat => [seat, 0]))
  };
  return dealRound(state, dealer, stacked([starter]));
}

test('play starts to the dealer\'s left after a starting number card', () => {
  const state = startWith(red('5'));
  assert.equal(state.dealer, 2);
  assert.equal(state.currentPlayer, 3);
  assert.equal(state.currentColor, 'red');
  assert.equal(state.direction, 1);
  assert.equal(startWith(red('5'), 3).currentPlayer, 1); // the left of the last seat is seat 1
});

test('a starting action card acts as if the dealer played it, but a Reverse lets the dealer start', () => {
  assert.equal(startWith(red('skip')).currentPlayer, 1);

  const drawTwo = startWith(red('drawTwo'));
  assert.equal(drawTwo.hands[3].length, 9);
  assert.equal(drawTwo.currentPlayer, 1);
  assert.equal(countCards(drawTwo), 108);

  const reversed = startWith(red('reverse'));
  assert.equal(reversed.direction, -1);
  assert.equal(reversed.currentPlayer, 2);
  const reversedTwo = startWith(red('reverse'), 1, 2);
  assert.equal(reversedTwo.currentPlayer, 1);
});

test('after a starting Wild the player to the dealer\'s left names the color, then plays', () => {
  const state = startWith(WILD);
  assert.equal(state.currentPlayer, 3);
  assert.equal(state.currentColor, null);
  assert.deepEqual(draw(state, 3), { error: 'Choose the first color' });
  assert.deepEqual(play(state, 3, state.hands[3][0]), { error: 'Choose the first color' });
  assert.deepEqual(move(state, 3, { type: 'chooseColor', color: 'pink' }), { error: 'Invalid move' });

  const chosen = ok(move(state, 3, { type: 'chooseColor', color: 'green' }));
  assert.equal(chosen.currentColor, 'green');
  assert.equal(chosen.currentPlayer, 3);
  assert.equal(chosen.gameStatus, 'P3 chose green to start');
  assert.deepEqual(move(chosen, 3, { type: 'chooseColor', color: 'red' }), { error: 'The color is already set' });
});

test('a starting Wild Draw Four is shuffled back into the deck and another card flipped', () => {
  const activePlayers = [1, 2, 3];
  const state = dealRound({ ...createGameState('g'), activePlayers }, 3, stacked([WILD_FOUR], seeded(5)));
  assert.notEqual(state.discardPile[0].value, 'wildDrawFour');
  assert.equal(countCards(state), 108);
  // Nobody was dealt the Wild Draw Four as the top card of the deck
  assert.equal(state.drawPile.filter(held => sameCard(held, WILD_FOUR)).length +
    Object.values(state.hands).flat().filter(held => sameCard(held, WILD_FOUR)).length, 4);
});

test('the public view shows only the viewer\'s own hand', () => {
  const state = { ...game(), drawnCard: blue('8') };
  const mine = toPublicState(state, true, 1);
  assert.deepEqual(mine.hand, state.hands[1]);
  assert.deepEqual(mine.handCounts, { 1: 3, 2: 2, 3: 2 });
  assert.equal(mine.drawPileCount, 4);
  assert.deepEqual(mine.discardTop, red('5'));
  assert.deepEqual(mine.drawnCard, blue('8'));
  assert.equal(mine.hasDrawn, true);
  for (const key of ['hands', 'drawPile', 'discardPile', 'turnHolder']) assert.equal(key in mine, false);

  const theirs = toPublicState(state, true, 2);
  assert.deepEqual(theirs.hand, state.hands[2]);
  assert.equal(theirs.drawnCard, null);
  assert.equal(theirs.hasDrawn, true);

  assert.deepEqual(toPublicState(state, false, null).hand, []);
});

test('playing a matching card moves the turn on', () => {
  const state = ok(play(game(), 1, red('7')));
  assert.deepEqual(state.discardPile, [red('5'), red('7')]);
  assert.deepEqual(state.hands[1], [blue('5'), blue('9')]);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.turnHolder, 2);
  assert.equal(state.started, true);
  assert.equal(state.gameStatus, 'Alice played red 7');
  assert.deepEqual(state.lastMove,
    { type: 'play', playerNumber: 1, card: red('7'), color: 'red', target: null, drew: 0, wentOut: false });

  const byNumber = ok(play(game(), 1, blue('5')));
  assert.equal(byNumber.currentColor, 'blue');
});

test('plays are validated', () => {
  assert.deepEqual(play(game(), 1, blue('9')), { error: 'That card does not match' });
  assert.deepEqual(play(game(), 1, red('1')), { error: 'You do not have that card' });
  assert.deepEqual(play(game(), 2, blue('1')), { error: 'Not your turn' });
  assert.deepEqual(move(game(), 1, { type: 'play', card: { color: 'pink', value: '7' } }), { error: 'Invalid move' });
  assert.deepEqual(move(game(), 1, { type: 'play', card: { color: 'red', value: 'wild' } }), { error: 'Invalid move' });
  assert.deepEqual(applyMove(uno, game(), 1, 'draw'), { error: 'Invalid move' });
  assert.deepEqual(applyMove(uno, game(), 1, null), { error: 'Invalid move' });
});

test('a Wild needs a color, which the next card must match', () => {
  const state = withHand(1, [WILD, blue('9')]);
  assert.deepEqual(play(state, 1, WILD), { error: 'Invalid move' });
  const played = ok(play(state, 1, WILD, 'green'));
  assert.equal(played.currentColor, 'green');
  assert.equal(played.gameStatus, 'Alice played Wild (green)');
  assert.deepEqual(play(played, 2, blue('1')), { error: 'That card does not match' });
});

test('Skip skips the next player', () => {
  const state = ok(play(withHand(1, [red('skip'), red('1'), red('2')]), 1, red('skip')));
  assert.equal(state.currentPlayer, 3);
  assert.equal(state.gameStatus, 'Alice played red Skip; Bob is skipped');
});

test('Reverse turns play around, and acts as a Skip with two players', () => {
  const hands = { ...game().hands, 1: [red('reverse'), red('1'), red('2')], 3: [red('3'), blue('4'), blue('6')] };
  const three = ok(play(game({ hands }), 1, red('reverse')));
  assert.equal(three.direction, -1);
  assert.equal(three.currentPlayer, 3);
  assert.equal(ok(play(three, 3, red('3'))).currentPlayer, 2);

  const two = ok(play(game({ hands, activePlayers: [1, 2] }), 1, red('reverse')));
  assert.equal(two.currentPlayer, 1);
  assert.equal(two.gameStatus, 'Alice played red Reverse; Bob is skipped');
});

test('Draw Two makes the next player draw 2 and lose their turn', () => {
  const two = ok(play(withHand(1, [red('drawTwo'), red('1'), red('2')]), 1, red('drawTwo')));
  assert.deepEqual(two.hands[2], [blue('1'), blue('2'), red('8'), blue('8')]);
  assert.equal(two.currentPlayer, 3);
  assert.equal(two.gameStatus, 'Alice played red Draw Two; Bob draws 2 and is skipped');
});

// Alice plays a Wild Draw Four and names blue while red is the color; Bob must answer it
const BIG_PILE = [blue('6'), blue('7'), blue('8'), red('8'), red('6'), red('4'), red('3'), red('2')];
const fourOn = (hand: Card[]) => ok(play(withHand(1, [WILD_FOUR, ...hand], { drawPile: BIG_PILE }), 1, WILD_FOUR, 'blue'));

test('a Wild Draw Four waits for the next player to accept or challenge it', () => {
  const four = fourOn([red('7'), blue('9')]);
  assert.equal(four.currentPlayer, 2);
  assert.equal(four.currentColor, 'blue');
  assert.equal(four.hands[2].length, 2);
  assert.deepEqual(four.pendingFour, { by: 1, target: 2, previousColor: 'red' });
  assert.equal(four.gameStatus, 'Alice played Wild Draw Four (blue); Bob may accept or challenge it');
  assert.deepEqual(draw(four, 2), { error: 'Accept the Wild Draw Four or challenge it' });
  assert.deepEqual(play(four, 2, blue('1')), { error: 'Accept the Wild Draw Four or challenge it' });

  const accepted = ok(move(four, 2, { type: 'accept' }));
  assert.equal(accepted.hands[2].length, 6);
  assert.equal(accepted.currentPlayer, 3);
  assert.equal(accepted.pendingFour, null);
  assert.equal(accepted.gameStatus, 'Bob accepted the Wild Draw Four, draws 4 and is skipped');
});

test('a challenge with no Wild Draw Four to answer is refused', () => {
  assert.deepEqual(move(game(), 1, { type: 'challenge' }), { error: 'There is no Wild Draw Four to answer' });
  assert.deepEqual(move(game(), 1, { type: 'accept' }), { error: 'There is no Wild Draw Four to answer' });
});

test('a won challenge makes the player who held the color draw 4, and the challenger plays', () => {
  const challenged = ok(move(fourOn([red('7'), blue('9')]), 2, { type: 'challenge' }));
  assert.equal(challenged.hands[1].length, 6);
  assert.equal(challenged.hands[2].length, 2);
  assert.equal(challenged.currentPlayer, 2);
  assert.equal(challenged.currentColor, 'blue');
  assert.equal(challenged.gameStatus, 'Bob challenged Alice\'s Wild Draw Four and won; Alice draws 4');
  assert.deepEqual(challenged.lastMove, { type: 'challenge', playerNumber: 2, challenged: 1, guilty: true, drew: 4 });
});

test('a lost challenge makes the challenger draw 6 and lose their turn', () => {
  // A card matching only the number, and a Wild, do not make a Wild Draw Four illegal
  const challenged = ok(move(fourOn([blue('5'), WILD]), 2, { type: 'challenge' }));
  assert.equal(challenged.hands[1].length, 2);
  assert.equal(challenged.hands[2].length, 8);
  assert.equal(challenged.currentPlayer, 3);
  assert.equal(challenged.gameStatus, 'Bob challenged Alice\'s Wild Draw Four and lost; Bob draws 6 and is skipped');
});

test('a lost challenge still shows the hand to the challenger, through other players\' moves', () => {
  const lost = ok(move(fourOn([blue('5'), blue('9')]), 2, { type: 'challenge' }));
  assert.equal(lost.currentPlayer, 3);
  const later = ok(draw(lost, 3));
  assert.deepEqual(toPublicState(later, true, 2).revealed, { of: 1, hand: [blue('5'), blue('9')] });
  assert.equal(toPublicState(later, true, 3).revealed, null);
  assert.equal(toPublicState(later, false, null).revealed, null);
});

test('the challenged hand is shown to the challenger only, and hidden again after their next move', () => {
  const challenged = ok(move(fourOn([red('7'), blue('9')]), 2, { type: 'challenge' }));
  const shown = [red('7'), blue('9')];
  assert.deepEqual(toPublicState(challenged, true, 2).revealed, { of: 1, hand: shown });
  assert.equal(toPublicState(challenged, true, 1).revealed, null);
  assert.equal(toPublicState(challenged, true, 3).revealed, null);
  assert.equal(toPublicState(challenged, false, null).revealed, null);
  assert.equal('to' in (toPublicState(challenged, true, 2).revealed ?? {}), false);

  const next = ok(play(challenged, 2, blue('1')));
  assert.equal(next.revealed, null);
  assert.equal(toPublicState(next, true, 2).revealed, null);
});

test('calling UNO with the second-to-last card leaves nothing to catch', () => {
  const called = ok(play(withHand(1, [red('7'), blue('9')]), 1, red('7'), undefined, true));
  assert.deepEqual(called.unoWindow, { seat: 1, called: true });
  assert.deepEqual(act(called, 3, 'catchUno'), { error: 'There is nobody to catch' });
});

test('a player caught not calling UNO before the next move draws 2', () => {
  const forgot = ok(play(withHand(1, [red('7'), blue('9')]), 1, red('7')));
  assert.deepEqual(forgot.unoWindow, { seat: 1, called: false });
  assert.deepEqual(act(forgot, 1, 'catchUno'), { error: 'There is nobody to catch' });

  const caught = ok(act(forgot, 3, 'catchUno'));
  assert.equal(caught.hands[1].length, 3);
  assert.equal(caught.unoWindow, null);
  assert.equal(caught.currentPlayer, 2);
  assert.equal(caught.gameStatus, 'Cara caught Alice not calling UNO; Alice draws 2');
  assert.deepEqual(act(caught, 2, 'catchUno'), { error: 'There is nobody to catch' });
});

test('a late UNO call counts until someone catches it, and the next move closes the window', () => {
  const forgot = ok(play(withHand(1, [red('7'), blue('9')]), 1, red('7')));
  assert.deepEqual(act(forgot, 2, 'callUno'), { error: 'Call UNO when you play your second-to-last card' });
  const late = ok(act(forgot, 1, 'callUno'));
  assert.deepEqual(late.unoWindow, { seat: 1, called: true });
  assert.equal(late.gameStatus, 'Alice called UNO!');
  assert.deepEqual(act(late, 2, 'catchUno'), { error: 'There is nobody to catch' });

  const moved = ok(draw(forgot, 2));
  assert.equal(moved.unoWindow, null);
  assert.deepEqual(act(moved, 3, 'catchUno'), { error: 'There is nobody to catch' });
  assert.deepEqual(act(game(), 1, 'callUno'), { error: 'Call UNO when you play your second-to-last card' });
});

test('actions are refused during a vote, after the game, or when unknown', () => {
  const forgot = ok(play(withHand(1, [red('7'), blue('9')]), 1, red('7')));
  assert.deepEqual(act({ ...forgot, undoVote: { requestedBy: 2, votes: { 2: true } } }, 3, 'catchUno'),
    { error: 'An undo vote is in progress' });
  assert.deepEqual(act({ ...forgot, dismissVote: { target: 2, requestedBy: 3, votes: { 3: true } } }, 3, 'catchUno'),
    { error: 'A dismiss vote is in progress' });
  assert.deepEqual(act({ ...forgot, isGameOver: true }, 3, 'catchUno'), { error: 'The game is over' });
  assert.deepEqual(act(forgot, 3, 'shout'), { error: 'Unknown action' });
  assert.deepEqual(act(forgot, 3, 'acknowledgeRound'), { error: 'Nothing to continue' });
});

test('drawing an unplayable card passes the turn', () => {
  const state = ok(draw(game(), 1));
  assert.deepEqual(state.hands[1].at(-1), red('8'));
  // The red 8 matches the red 5, so it may be played; a blue 6 would not
  assert.deepEqual(state.drawnCard, red('8'));
  assert.equal(state.currentPlayer, 1);

  const unplayable = ok(draw(game({ drawPile: [blue('6')] }), 1));
  assert.equal(unplayable.drawnCard, null);
  assert.equal(unplayable.currentPlayer, 2);
  assert.equal(unplayable.gameStatus, 'Alice drew a card and could not play it');
  assert.deepEqual(unplayable.lastMove, { type: 'draw', playerNumber: 1, passed: true });
});

test('a playable drawn card may be played at once, or kept by passing', () => {
  const drawn = ok(draw(game(), 1));
  assert.deepEqual(draw(drawn, 1), { error: 'You already drew a card' });
  assert.deepEqual(play(drawn, 1, red('7')), { error: 'You may only play the card you drew' });

  const played = ok(play(drawn, 1, red('8')));
  assert.equal(played.currentPlayer, 2);
  assert.equal(played.drawnCard, null);

  const passed = ok(pass(drawn, 1));
  assert.equal(passed.currentPlayer, 2);
  assert.equal(passed.hands[1].length, 4);
  assert.equal(passed.gameStatus, 'Alice passed');
  assert.deepEqual(pass(game(), 1), { error: 'Draw a card before passing' });
});

test('an empty draw pile is refilled from the discards, keeping the top card', () => {
  const state = game({ drawPile: [], discardPile: [blue('6'), blue('7'), red('5')] });
  const drawn = ok(draw(state, 1));
  assert.deepEqual(drawn.discardPile, [red('5')]);
  assert.equal(drawn.drawPile.length, 1);
  assert.equal(countCards(drawn), countCards(state));
});

test('with nothing left to draw, a player may pass', () => {
  const state = game({ drawPile: [], discardPile: [red('5')] });
  assert.deepEqual(draw(state, 1), { error: 'There are no cards left to draw' });
  assert.equal(ok(pass(state, 1)).currentPlayer, 2);
});

test('going out ends the round and scores the cards left in the other hands', () => {
  const state = ok(play(withHand(1, [red('7')]), 1, red('7')));
  assert.equal(state.isGameOver, false);
  assert.equal(state.currentPlayer, null);
  assert.deepEqual(state.scores, { 1: 10, 2: 0, 3: 0 }); // 1 + 2, and 3 + 4
  assert.deepEqual(state.roundSummary, { roundNumber: 1, wentOut: 1, points: 10, cardsLeft: { 1: 0, 2: 2, 3: 2 }, acknowledged: [] });
  assert.equal(state.gameStatus, 'Alice went out and scores 10 points. Waiting for everyone to continue.');
  assert.equal(state.lastMove?.type === 'play' && state.lastMove.wentOut, true);
  assert.deepEqual(play(state, 2, blue('1')), { error: 'Not your turn' });
});

test('going out on a Draw Two or Wild Draw Four makes the next player draw before the scoring', () => {
  const two = ok(play(withHand(1, [red('drawTwo')]), 1, red('drawTwo')));
  assert.equal(two.hands[2].length, 4);
  assert.equal(two.scores[1], 1 + 2 + 8 + 8 + 3 + 4);
  assert.equal(two.gameStatus, 'Alice went out and scores 26 points. Waiting for everyone to continue.');
  assert.deepEqual(two.lastMove,
    { type: 'play', playerNumber: 1, card: red('drawTwo'), color: 'red', target: 2, drew: 2, wentOut: true });

  const four = ok(play(withHand(1, [WILD_FOUR]), 1, WILD_FOUR, 'green'));
  assert.equal(four.hands[2].length, 6);
  assert.equal(four.pendingFour, null);
  assert.equal(four.scores[1], 1 + 2 + 6 + 7 + 8 + 8 + 3 + 4);
});

test('the first player to reach 500 points wins the game', () => {
  const state = ok(play(withHand(1, [red('7')], { scores: { 1: 495, 2: 480, 3: 0 } }), 1, red('7')));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.scores[1], 505);
  assert.equal(state.gameStatus, 'Alice went out and wins with 505 points!');
  assert.deepEqual(act(state, 2, 'acknowledgeRound'), { error: 'The game is over' });
});

test('the next round is dealt once every connected player continues, and the deal passes left', () => {
  const ended = ok(play(withHand(1, [red('7')]), 1, red('7')));
  const one = ok(act(ended, 1, 'acknowledgeRound', seeded(6)));
  assert.deepEqual(one.roundSummary?.acknowledged, [1]);
  assert.equal(one.gameStatus, 'Alice is ready for the next round');
  assert.deepEqual(act(one, 1, 'acknowledgeRound'), { state: one });
  const two = ok(act(one, 2, 'acknowledgeRound', seeded(6)));
  assert.equal(two.roundSummary?.acknowledged.length, 2);

  const next = ok(act(two, 3, 'acknowledgeRound', seeded(6)));
  assert.equal(next.roundSummary, null);
  assert.equal(next.roundNumber, 2);
  assert.equal(next.dealer, 1);
  assert.deepEqual(next.scores, { 1: 10, 2: 0, 3: 0 });
  assert.equal(countCards(next), 108);
  assert.ok(next.currentPlayer !== null);
  assert.equal(next.gameStatus, 'Round 2: Alice deals');
});

test('the next round does not wait for disconnected players', () => {
  const ended = ok(play(withHand(1, [red('7')]), 1, red('7')));
  const one = ok(act({ ...ended, disconnected: [3] }, 1, 'acknowledgeRound', seeded(7)));
  assert.equal(ok(act(one, 2, 'acknowledgeRound', seeded(7))).roundNumber, 2);

  // A disconnect can be all the summary was waiting for
  const waiting = ok(act(ok(act(ended, 1, 'acknowledgeRound')), 2, 'acknowledgeRound'));
  assert.equal(disconnectPlayer(uno, waiting, 3, seeded(7)).roundNumber, 2);
});

test('a player leaving mid-game puts their hand under the draw pile', () => {
  const state = removePlayer(uno, game({ currentPlayer: 2, turnHolder: 2 }), 3);
  assert.deepEqual(Object.keys(state.hands), ['1', '2']);
  assert.deepEqual(state.drawPile.slice(0, 2), [blue('3'), blue('4')]);
  assert.equal(state.currentPlayer, 2);
});

test('the turn of a player who leaves passes on in the direction of play', () => {
  const upward = removePlayer(uno, game({ currentPlayer: 2, turnHolder: 2 }), 2);
  assert.equal(upward.currentPlayer, 3);

  const downward = removePlayer(uno, game({ currentPlayer: 2, turnHolder: 2, direction: -1, drawnCard: blue('6') }), 2);
  assert.equal(downward.currentPlayer, 1);
  assert.equal(downward.turnHolder, 1);
  assert.equal(downward.drawnCard, null);
});

test('a Wild Draw Four waiting on a player who leaves is dropped', () => {
  const four = fourOn([red('7'), blue('9')]);
  const left = removePlayer(uno, four, 2);
  assert.equal(left.pendingFour, null);
  assert.equal(left.currentPlayer, 3);
  assert.equal(ok(play(left, 3, blue('3'))).currentPlayer, 1);
});

test('the game ends at the chosen target', () => {
  const finish = (mine: number, target: number) =>
    ok(play(withHand(1, [red('7')], { scores: { 1: mine, 2: 0, 3: 0 }, houseRules: withRules({ targetScore: target }) }), 1, red('7')));
  const over = finish(240, 250); // going out is worth 10
  assert.equal(over.isGameOver, true);
  assert.deepEqual(over.winners, [1]);
  assert.equal(over.gameStatus, 'Alice went out and wins with 250 points!');
  assert.equal(finish(239, 250).isGameOver, false);
  assert.equal(finish(240, 500).isGameOver, false);
  assert.equal(targetScore({}), 500);
});

// House rules: stacking, 7-0 and draw until you can play
const stackRules = { houseRules: withRules({ stacking: true }) };
const sevenZero = { houseRules: withRules({ sevenZero: true }) };
const stackGame = (hands: GameState['hands'], overrides: Partial<GameState> = {}) =>
  game({ ...stackRules, hands: { ...game().hands, ...hands }, ...overrides });
const STACK_ERROR = { error: 'Stack a Draw Two or Wild Draw Four, or accept the cards' };

test('a Draw Two can be stacked and the next player draws four', () => {
  const state = stackGame({ 1: [red('drawTwo'), red('1')], 2: [blue('drawTwo'), blue('1')], 3: [blue('3'), blue('4')] });
  const first = ok(play(state, 1, red('drawTwo')));
  assert.deepEqual(first.pendingDraw, { count: 2, target: 2 });
  assert.equal(first.currentPlayer, 2);
  assert.equal(first.hands[2].length, 2);
  assert.equal(first.gameStatus, 'Alice played red Draw Two; Bob must stack or draw 2');

  const second = ok(play(first, 2, blue('drawTwo')));
  assert.deepEqual(second.pendingDraw, { count: 4, target: 3 });
  assert.equal(second.currentPlayer, 3);
  assert.equal(second.currentColor, 'blue');
  assert.equal(second.hands[3].length, 2);

  assert.deepEqual(move(second, 3, { type: 'draw' }), STACK_ERROR);
  assert.deepEqual(play(second, 3, blue('3')), STACK_ERROR);
});

test('a Wild Draw Four stacks on a Draw Two but not the other way round', () => {
  const state = stackGame({ 1: [red('drawTwo'), red('1')], 2: [WILD_FOUR, blue('1')], 3: [blue('3'), blue('4')] });
  const stacked = ok(play(ok(play(state, 1, red('drawTwo'))), 2, WILD_FOUR, 'green'));
  assert.deepEqual(stacked.pendingDraw, { count: 6, target: 3 });
  assert.equal(stacked.pendingFour, null);
  assert.equal(stacked.currentColor, 'green');

  const four = stackGame({ 1: [WILD_FOUR, red('1')], 2: [blue('drawTwo'), blue('1')] });
  const played = ok(play(four, 1, WILD_FOUR, 'blue'));
  assert.deepEqual(played.pendingDraw, { count: 4, target: 2 });
  assert.deepEqual(played.pendingFour, { by: 1, target: 2, previousColor: 'red' });
  assert.deepEqual(play(played, 2, blue('drawTwo')), { error: 'A Draw Two cannot go on a Wild Draw Four' });
});

test('accepting a stack draws the whole count and loses the turn', () => {
  const state = stackGame({ 1: [red('drawTwo'), red('1')], 2: [blue('drawTwo'), blue('1')], 3: [blue('3'), blue('4')] });
  const stacked = ok(play(ok(play(state, 1, red('drawTwo'))), 2, blue('drawTwo')));
  const accepted = ok(move(stacked, 3, { type: 'accept' }));
  assert.equal(accepted.hands[3].length, 6);
  assert.equal(accepted.pendingDraw, null);
  assert.equal(accepted.currentPlayer, 1);
  assert.deepEqual(accepted.lastMove, { type: 'accept', playerNumber: 3, drew: 4, stacked: true });
  assert.equal(accepted.gameStatus, 'Cara accepted the stack, draws 4 and is skipped');

  // A lone Draw Two is accepted the same way
  const lone = ok(move(ok(play(state, 1, red('drawTwo'))), 2, { type: 'accept' }));
  assert.equal(lone.hands[2].length, 4);
  assert.equal(lone.currentPlayer, 3);
});

test('a stacked Wild Draw Four cannot be challenged', () => {
  const state = stackGame({ 1: [red('drawTwo'), red('1')], 2: [WILD_FOUR, blue('1')], 3: [blue('3'), blue('4')] });
  const stacked = ok(play(ok(play(state, 1, red('drawTwo'))), 2, WILD_FOUR, 'green'));
  assert.deepEqual(move(stacked, 3, { type: 'challenge' }), { error: 'There is no Wild Draw Four to answer' });

  // On its own it can be challenged, or stacked on, which ends the challenge
  const lone = stackGame({ 1: [WILD_FOUR, red('1')], 2: [WILD_FOUR, blue('1')] }, { drawPile: BIG_PILE });
  const four = ok(play(lone, 1, WILD_FOUR, 'blue'));
  assert.equal(ok(move(four, 2, { type: 'challenge' })).pendingDraw, null);
  const onFour = ok(play(four, 2, WILD_FOUR, 'blue'));
  assert.deepEqual(onFour.pendingDraw, { count: 8, target: 3 });
  assert.equal(onFour.pendingFour, null);
});

test('a stack that goes out makes the next player draw the whole count', () => {
  const state = stackGame({ 1: [red('drawTwo'), red('1')], 2: [blue('drawTwo')], 3: [blue('3')] });
  const out = ok(play(ok(play(state, 1, red('drawTwo'))), 2, blue('drawTwo')));
  assert.equal(out.roundSummary?.cardsLeft[3], 5);
  assert.equal(out.pendingDraw, null);
});

test('without the stacking rule a Draw Two still draws at once', () => {
  const state = ok(play(withHand(1, [red('drawTwo'), red('1')]), 1, red('drawTwo')));
  assert.equal(state.pendingDraw, null);
  assert.equal(state.hands[2].length, 4);
});

test('a 7 swaps hands with the chosen player', () => {
  const swapped = ok(move(game(sevenZero), 1, { type: 'play', card: red('7'), swapWith: 3 }));
  assert.deepEqual(swapped.hands[1], [blue('3'), blue('4')]);
  assert.deepEqual(swapped.hands[3], [blue('5'), blue('9')]);
  assert.deepEqual(swapped.hands[2], [blue('1'), blue('2')]);
  assert.equal(swapped.currentPlayer, 2);
  assert.deepEqual(swapped.lastMove,
    { type: 'play', playerNumber: 1, card: red('7'), color: 'red', target: null, drew: 0, wentOut: false, swappedWith: 3 });
  assert.equal(swapped.gameStatus, 'Alice played red 7; swaps hands with Cara');
  assert.equal(swapped.unoWindow, null);
});

test('a 7 without a player is refused', () => {
  const state = game(sevenZero);
  const refused = { error: 'Choose a player to swap hands with' };
  assert.deepEqual(play(state, 1, red('7')), refused);
  assert.deepEqual(move(state, 1, { type: 'play', card: red('7'), swapWith: 1 }), refused);
  assert.deepEqual(move(state, 1, { type: 'play', card: red('7'), swapWith: 9 }), refused);
  // Without the rule the 7 plays as it always did
  assert.equal(ok(play(game(), 1, red('7'))).hands[2].length, 2);
});

test('a 0 passes every hand in the direction of play', () => {
  const hands = { 1: [red('0'), blue('5')], 2: [blue('1'), blue('2')], 3: [blue('3'), blue('4'), blue('6')] };
  const up = ok(play(game({ ...sevenZero, hands }), 1, red('0')));
  assert.deepEqual(up.hands, { 1: [blue('3'), blue('4'), blue('6')], 2: [blue('5')], 3: [blue('1'), blue('2')] });
  assert.equal(up.currentPlayer, 2);
  assert.equal(up.gameStatus, 'Alice played red 0; every hand passes on');

  const down = ok(play(game({ ...sevenZero, hands, direction: -1 }), 1, red('0')));
  assert.deepEqual(down.hands, { 1: [blue('1'), blue('2')], 2: [blue('3'), blue('4'), blue('6')], 3: [blue('5')] });
});

test('a 7 that goes out swaps nothing', () => {
  const out = ok(play(withHand(1, [red('7')], sevenZero), 1, red('7')));
  assert.equal(out.roundSummary?.wentOut, 1);
  assert.deepEqual(out.hands[2], [blue('1'), blue('2')]);
  const zero = ok(play(withHand(1, [red('0')], sevenZero), 1, red('0')));
  assert.deepEqual(zero.hands[2], [blue('1'), blue('2')]);
});

const untilPlayable = { houseRules: withRules({ drawUntilPlayable: true }) };

test('drawing until you can play stops at the first playable card', () => {
  const state = game({ ...untilPlayable, drawPile: [red('9'), blue('6'), blue('7'), blue('8')] });
  const drew = ok(draw(state, 1));
  assert.deepEqual(drew.hands[1].slice(3), [blue('8'), blue('7'), blue('6'), red('9')]);
  assert.deepEqual(drew.drawnCard, red('9'));
  assert.equal(drew.currentPlayer, 1);
  assert.deepEqual(drew.lastMove, { type: 'draw', playerNumber: 1, passed: false, count: 4 });
  assert.equal(drew.gameStatus, 'Alice drew 4 cards');
  assert.equal(ok(pass(drew, 1)).currentPlayer, 2);

  // Without the rule one card is drawn as before
  assert.equal(ok(draw(game({ drawPile: [red('9'), blue('6')] }), 1)).hands[1].length, 4);
});

test('drawing until you can play stops when the pile is empty', () => {
  const state = game({ ...untilPlayable, drawPile: [blue('6'), blue('7')], discardPile: [red('5')] });
  const drew = ok(draw(state, 1));
  assert.equal(drew.hands[1].length, 5);
  assert.equal(drew.drawPile.length, 0);
  assert.equal(drew.currentPlayer, 2);
  assert.deepEqual(drew.lastMove, { type: 'draw', playerNumber: 1, passed: true, count: 2 });
  assert.equal(drew.gameStatus, 'Alice drew 2 cards and could not play any');
});

test('accepting a stack with a short draw pile reshuffles the discards, then draws what is left', () => {
  const hands = { 1: [red('drawTwo'), red('1')], 2: [blue('drawTwo'), blue('1')], 3: [blue('3'), blue('4')] };
  // Four owed, two in the draw pile; the discards below the top card are reshuffled in
  const stackedOn = (overrides: Partial<GameState>) =>
    ok(play(ok(play(stackGame(hands, overrides), 1, red('drawTwo'))), 2, blue('drawTwo')));
  const reshuffled = ok(move(stackedOn({ drawPile: [blue('6'), blue('7')], discardPile: [red('1'), red('2'), red('5')] }), 3, { type: 'accept' }));
  assert.equal(reshuffled.lastMove?.type === 'accept' && reshuffled.lastMove.drew, 4);
  assert.equal(reshuffled.hands[3].length, 6);
  assert.equal(reshuffled.gameStatus, 'Cara accepted the stack, draws 4 and is skipped');

  // Too few cards in total (one in the draw pile, two reshuffled from the discards, four owed): only what exists is drawn
  const short = ok(move(stackedOn({ drawPile: [blue('6')], discardPile: [red('5')] }), 3, { type: 'accept' }));
  assert.equal(short.lastMove?.type === 'accept' && short.lastMove.drew, 3);
  assert.equal(short.hands[3].length, 5);
  assert.equal(short.gameStatus, 'Cara accepted the stack, draws 3 and is skipped');
  assert.equal(short.currentPlayer, 1);
});

test('a saved game without pendingDraw plays on', () => {
  const { pendingDraw: _gone, ...old } = stackGame({});
  const state = ok(play(old as GameState, 1, red('7')));
  assert.equal(state.currentPlayer, 2);
  assert.equal(toPublicState(old as GameState, true, 1).pendingDraw, null);
});

// House rule: jump-in
const jumpRules = { houseRules: withRules({ jumpIn: true }) };
const jumpGame = (hands: GameState['hands'], overrides: Partial<GameState> = {}) =>
  game({ ...jumpRules, hands: { ...game().hands, ...hands }, ...overrides });
const jumps = (state: GameState, seat: number, played: Card) =>
  uno.allowsOutOfTurn?.(state, seat, { type: 'play', card: played }) ?? assert.fail('UNO allows out of turn play');

test('allowsOutOfTurn accepts only an exact number match with jump-in on', () => {
  const hands = { 2: [red('5'), red('6'), blue('5'), red('skip'), WILD], 3: [blue('3'), blue('4')] };
  const state = jumpGame(hands);
  assert.equal(jumps(state, 2, red('5')), true);
  for (const other of [red('6'), blue('5'), red('skip'), WILD]) assert.equal(jumps(state, 2, other), false);
  assert.equal(jumps(state, 2, red('9')), false); // not in the hand
  assert.equal(jumps(state, 4, red('5')), false); // not seated
  const off = game({ hands: { ...game().hands, ...hands } });
  assert.equal(jumps(off, 2, red('5')), false);
  assert.deepEqual(move(off, 2, { type: 'play', card: red('5') }), { error: 'Not your turn' });
  assert.equal(uno.allowsOutOfTurn?.(state, 2, { type: 'draw' }), false);
  const topAction = jumpGame({ 2: [red('skip')] }, { discardPile: [red('skip')] });
  assert.equal(jumps(topAction, 2, red('skip')), false);
});

test('a jump-in moves the turn on from the jumper', () => {
  const state = jumpGame({ 2: [red('5'), blue('1')] }, { drawnCard: blue('9') });
  const jumped = ok(play(state, 2, red('5')));
  assert.equal(jumped.currentPlayer, 3);
  assert.equal(jumped.turnHolder, 3);
  assert.equal(jumped.drawnCard, null);
  assert.deepEqual(jumped.hands[2], [blue('1')]);
  assert.deepEqual(jumped.discardPile, [red('5'), red('5')]);
  assert.equal(jumped.lastMove?.type === 'play' && jumped.lastMove.jumpedIn, true);
  assert.equal(jumped.gameStatus, 'Bob jumped in with red 5');
  // The turn holder's drawn card is no longer theirs to play
  assert.deepEqual(play(jumped, 1, blue('9')), { error: 'Not your turn' });
  // A normal play is not marked
  const normal = ok(play(jumpGame({ 1: [red('5'), blue('1')] }), 1, red('5')));
  assert.equal(normal.lastMove?.type === 'play' && 'jumpedIn' in normal.lastMove, false);
});

test('a jump-in continues in the current direction, and a jumped 7 still swaps with 7-0', () => {
  const backwards = jumpGame({ 3: [red('5'), blue('1')] }, { direction: -1 });
  assert.equal(ok(play(backwards, 3, red('5'))).currentPlayer, 2);
  const seven = jumpGame({ 2: [red('7'), blue('1'), blue('2')] }, {
    houseRules: withRules({ jumpIn: true, sevenZero: true }), discardPile: [red('7')]
  });
  const swapped = ok(move(seven, 2, { type: 'play', card: red('7'), swapWith: 3 }));
  assert.deepEqual(swapped.hands[2], [blue('3'), blue('4')]);
  assert.equal(swapped.currentPlayer, 3);
});

test('a jump-in that empties the hand goes out', () => {
  const out = ok(play(jumpGame({ 2: [red('5')] }), 2, red('5')));
  assert.equal(out.roundSummary?.wentOut, 2);
  assert.equal(out.currentPlayer, null);
});

test('a jump-in closes the UNO window, and can open its own', () => {
  const state = jumpGame({ 2: [red('5'), blue('1'), blue('2')] }, { unoWindow: { seat: 1, called: false } });
  assert.equal(ok(play(state, 2, red('5'))).unoWindow, null);
  assert.deepEqual(ok(play(jumpGame({ 2: [red('5'), blue('1')] }), 2, red('5'))).unoWindow, { seat: 2, called: false });
});

test('a jump-in during a Draw stack is refused', () => {
  const hands = { 2: [red('5'), blue('1')], 3: [red('drawTwo'), blue('4')] };
  const stack = jumpGame(hands, {
    houseRules: withRules({ jumpIn: true, stacking: true }), pendingDraw: { count: 2, target: 1 }, discardPile: [red('5')]
  });
  assert.equal(jumps(stack, 2, red('5')), false);
  assert.deepEqual(play(stack, 2, red('5')), { error: 'Not your turn' });
  const four = jumpGame(hands, { pendingFour: { by: 3, target: 1, previousColor: 'red' } });
  assert.equal(jumps(four, 2, red('5')), false);
  const summary = jumpGame(hands, { roundSummary: { roundNumber: 1, wentOut: 3, points: 0, cardsLeft: {}, acknowledged: [] } });
  assert.equal(jumps(summary, 2, red('5')), false);
  const starting = jumpGame(hands, { currentColor: null, discardPile: [WILD] });
  assert.equal(jumps(starting, 2, red('5')), false);
});

test('finalStandings ranks by the highest score', () => {
  const state: GameState = {
    ...createGameState('t'), activePlayers: [1, 2, 3], isGameOver: true, winners: [3], scores: { 1: 120, 2: 120, 3: 520 }
  };
  assert.deepEqual(finalStandings(state), [
    { seat: 3, place: 1, score: '520 points' },
    { seat: 1, place: 2, score: '120 points' }, { seat: 2, place: 2, score: '120 points' }
  ]);
});
