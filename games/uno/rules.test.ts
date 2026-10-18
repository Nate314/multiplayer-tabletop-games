import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, canPlay, cardName, createGameState, stepFrom, toPublicState } from './rules.ts';
import { uno } from './index.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { Card, Color, GameState, Result, Value } from './types.ts';

const card = (color: Color | 'wild', value: Value): Card => ({ color, value });
const red = (value: Value) => card('red', value);
const blue = (value: Value) => card('blue', value);
const WILD = card('wild', 'wild');
const WILD_FOUR = card('wild', 'wildDrawFour');

// Always picks the last index, so a shuffle leaves the deck in order
const noShuffle = () => 0.999999;

function lobby(...names: string[]): GameState {
  let state = createGameState('g');
  for (const name of names) {
    const result = addPlayer(uno, state, name, noShuffle);
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
    hands: { 1: [red('7'), blue('5'), blue('9')], 2: [blue('1'), blue('2')], 3: [blue('3'), blue('4')] },
    drawPile: [blue('6'), blue('7'), blue('8'), red('8')],
    discardPile: [red('5')],
    currentColor: 'red',
    ...overrides
  };
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

const play = (state: GameState, seat: number, played: Card, color?: Color) =>
  applyMove(uno, state, seat, { type: 'play', card: played, color }, noShuffle);
const draw = (state: GameState, seat: number) => applyMove(uno, state, seat, { type: 'draw' }, noShuffle);
const pass = (state: GameState, seat: number) => applyMove(uno, state, seat, { type: 'pass' }, noShuffle);

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
  // After a starting Wild anything plays
  assert.equal(canPlay(blue('6'), WILD, null), true);
});

test('cards are named for the status line', () => {
  assert.equal(cardName(red('7')), 'red 7');
  assert.equal(cardName(blue('drawTwo')), 'blue Draw Two');
  assert.equal(cardName(WILD_FOUR), 'Wild Draw Four');
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
});

test('seven cards each are dealt and a starting card flipped, afresh whenever the lobby changes', () => {
  const two = lobby('Alice', 'Bob');
  assert.equal(two.hands[1].length, 7);
  assert.equal(two.hands[2].length, 7);
  assert.equal(two.discardPile.length, 1);
  assert.equal(countCards(two), 108);
  assert.equal(two.gameStatus, 'Bob joined (2/8 players)');

  const three = lobby('A', 'B', 'C');
  assert.equal(countCards(three), 108);
  const left = removePlayer(uno, three, 2, noShuffle);
  assert.deepEqual(Object.keys(left.hands), ['1', '3']);
  assert.equal(countCards(left), 108);
  assert.equal(left.started, false);
});

// Deals with `starter` flipped: the shuffle moves it to the top of the deck and leaves the rest in order
function startWith(starter: Card, players = 3): GameState {
  let state = createGameState('g');
  state = { ...state, activePlayers: Array.from({ length: players }, (_, i) => i + 1), currentPlayer: 1 };
  state = { ...state, playerNames: Object.fromEntries(state.activePlayers.map(seat => [seat, `P${seat}`])) };
  const deck = buildDeck();
  const target = deck.findIndex(c => c.color === starter.color && c.value === starter.value);
  // Fisher-Yates swaps index i with floor(random * (i + 1)); the first swap moves `target` to the end
  let first = true;
  const random = () => {
    if (!first) return 0.999999;
    first = false;
    return (target + 0.5) / deck.length;
  };
  return uno.resetLobby(state, random);
}

test('a starting number card lets seat 1 play first in its color', () => {
  const state = startWith(red('5'));
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.currentColor, 'red');
  assert.equal(state.direction, 1);
});

test('starting action cards take effect as if played just before seat 1', () => {
  assert.equal(startWith(red('skip')).currentPlayer, 2);

  const reversed = startWith(red('reverse'));
  assert.equal(reversed.direction, -1);
  assert.equal(reversed.currentPlayer, 3);
  assert.equal(startWith(red('reverse'), 2).currentPlayer, 2);

  const drawTwo = startWith(red('drawTwo'));
  assert.equal(drawTwo.hands[1].length, 9);
  assert.equal(drawTwo.currentPlayer, 2);
  assert.equal(countCards(drawTwo), 108);

  const wild = startWith(WILD);
  assert.equal(wild.currentPlayer, 1);
  assert.equal(wild.currentColor, null);
});

test('a starting Wild Draw Four is put back and another card flipped', () => {
  const state = startWith(WILD_FOUR);
  assert.notEqual(state.discardPile[0].value, 'wildDrawFour');
  assert.equal(countCards(state), 108);
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
  assert.deepEqual(state.lastMove, { type: 'play', playerNumber: 1, card: red('7'), color: 'red', target: null, drew: 0 });

  const byNumber = ok(play(game(), 1, blue('5')));
  assert.equal(byNumber.currentColor, 'blue');
});

test('plays are validated', () => {
  assert.deepEqual(play(game(), 1, blue('9')), { error: 'That card does not match' });
  assert.deepEqual(play(game(), 1, red('1')), { error: 'You do not have that card' });
  assert.deepEqual(play(game(), 2, blue('1')), { error: 'Not your turn' });
  assert.deepEqual(applyMove(uno, game(), 1, { type: 'play', card: { color: 'pink', value: '7' } }), { error: 'Invalid move' });
  assert.deepEqual(applyMove(uno, game(), 1, { type: 'play', card: { color: 'red', value: 'wild' } }), { error: 'Invalid move' });
  assert.deepEqual(applyMove(uno, game(), 1, 'draw'), { error: 'Invalid move' });
  assert.deepEqual(applyMove(uno, game(), 1, null), { error: 'Invalid move' });
});

test('a Wild needs a color, which the next card must match', () => {
  const state = game({ hands: { ...game().hands, 1: [WILD, blue('9')] } });
  assert.deepEqual(play(state, 1, WILD), { error: 'Invalid move' });
  const played = ok(play(state, 1, WILD, 'green'));
  assert.equal(played.currentColor, 'green');
  assert.equal(played.gameStatus, 'Alice played Wild (green)');
  assert.deepEqual(play(played, 2, blue('1')), { error: 'That card does not match' });
});

test('Skip skips the next player', () => {
  const state = ok(play(game({ hands: { ...game().hands, 1: [red('skip'), red('1')] } }), 1, red('skip')));
  assert.equal(state.currentPlayer, 3);
  assert.equal(state.gameStatus, 'Alice played red Skip; Bob is skipped');
});

test('Reverse turns play around, and acts as a Skip with two players', () => {
  const hands = { ...game().hands, 1: [red('reverse'), red('1')], 3: [red('3'), blue('4')] };
  const three = ok(play(game({ hands }), 1, red('reverse')));
  assert.equal(three.direction, -1);
  assert.equal(three.currentPlayer, 3);
  assert.equal(ok(play(three, 3, red('3'))).currentPlayer, 2);

  const two = ok(play(game({ hands, activePlayers: [1, 2] }), 1, red('reverse')));
  assert.equal(two.currentPlayer, 1);
  assert.equal(two.gameStatus, 'Alice played red Reverse; Bob is skipped');
});

test('Draw Two and Wild Draw Four make the next player draw and lose their turn', () => {
  const two = ok(play(game({ hands: { ...game().hands, 1: [red('drawTwo'), red('1')] } }), 1, red('drawTwo')));
  assert.deepEqual(two.hands[2], [blue('1'), blue('2'), red('8'), blue('8')]);
  assert.equal(two.currentPlayer, 3);
  assert.equal(two.gameStatus, 'Alice played red Draw Two; Bob draws 2 and is skipped');

  const four = ok(play(game({ hands: { ...game().hands, 1: [WILD_FOUR, red('7')] } }), 1, WILD_FOUR, 'blue'));
  assert.equal(four.hands[2].length, 6);
  assert.equal(four.currentPlayer, 3);
  assert.equal(four.currentColor, 'blue');
  assert.deepEqual(four.lastMove, { type: 'play', playerNumber: 1, card: WILD_FOUR, color: 'blue', target: 2, drew: 4 });
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

test('the first player to empty their hand wins', () => {
  const state = ok(play(game({ hands: { ...game().hands, 1: [red('drawTwo')] } }), 1, red('drawTwo')));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.hands[2].length, 2);
  assert.equal(state.gameStatus, 'Alice played red Draw Two and wins!');
  assert.deepEqual(play(state, 1, red('7')), { error: 'The game is over' });
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
