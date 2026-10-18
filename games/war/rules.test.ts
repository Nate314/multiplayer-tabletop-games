import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove as rulesMove, createGameState } from './rules.ts';
import { war } from './index.ts';
import { addPlayer, applyMove, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import { sameCard, standardDeck } from '../../shared/playingCards.ts';
import type { PlayingCard, Rank, Suit } from '../../shared/playingCards.ts';
import { shuffle } from '../../shared/shuffle.ts';
import type { Random } from '../../shared/types.ts';
import type { GameState, PublicGameState } from './types.ts';

const card = (rank: Rank, suit: Suit): PlayingCard => ({ rank, suit });
const FLIP = { type: 'flip' };

// Always picks the last index, so a shuffle leaves the cards in order
const noShuffle: Random = () => 0.999999;

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

function lobby(...names: string[]): GameState {
  let state = createGameState('g');
  for (const name of names) {
    const result = addPlayer(war, state, name, seeded(7));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

// A game under way between Alice (seat 1, to flip) and Bob, with known piles, top card first
function game(alice: PlayingCard[], bob: PlayingCard[], overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState('g'),
    started: true,
    currentPlayer: 1,
    activePlayers: [1, 2],
    playerNames: { 1: 'Alice', 2: 'Bob' },
    piles: { 1: alice, 2: bob },
    ...overrides
  };
}

function ok(result: ReturnType<typeof rulesMove>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

// Flips for whoever's turn it is, through the platform's turn checks
function flip(state: GameState, random: Random = noShuffle): GameState {
  const seat = state.currentPlayer ?? assert.fail('nobody to flip');
  const result = applyMove(war, state, seat, FLIP, random);
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function flips(state: GameState, count: number, random: Random = noShuffle): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = flip(next, random);
  return next;
}

const total = (state: GameState) =>
  Object.values(state.piles).flat().length + Object.values(state.battle?.cards ?? {}).flat().length;

test('deal gives each player 26', () => {
  const state = lobby('Alice', 'Bob');
  assert.equal(state.piles[1].length, 26);
  assert.equal(state.piles[2].length, 26);
  const all = [...state.piles[1], ...state.piles[2]];
  for (const wanted of standardDeck()) assert.equal(all.filter(held => sameCard(held, wanted)).length, 1);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.battle, null);
});

test('nothing is dealt to a single player, and the deal is redone when the second joins', () => {
  const alone = lobby('Alice');
  assert.deepEqual(alone.piles, { 1: [] });
  const two = lobby('Alice', 'Bob');
  assert.equal(two.piles[1].length + two.piles[2].length, 52);
});

test('the first flip turns up a card and passes the turn', () => {
  const state = ok(rulesMove(game([card('K', 'spades'), card('2', 'clubs')], [card('A', 'hearts')]), 1, FLIP, noShuffle));
  assert.deepEqual(state.piles[1], [card('2', 'clubs')]);
  assert.deepEqual(state.battle?.cards[1], [{ card: card('K', 'spades'), faceUp: true }]);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.lastMove?.outcome, { kind: 'waiting' });
  assert.equal(state.gameStatus, 'Alice turned up the king of spades');
});

test('higher card takes both, aces beat kings', () => {
  const start = game([card('K', 'spades'), card('2', 'clubs')], [card('A', 'hearts'), card('3', 'clubs')]);
  const state = flips(start, 2);
  assert.equal(state.battle, null);
  assert.deepEqual(state.piles[1], [card('2', 'clubs')]);
  assert.deepEqual(state.piles[2], [card('3', 'clubs'), card('K', 'spades'), card('A', 'hearts')]);
  assert.deepEqual(state.lastMove?.outcome, { kind: 'won', winner: 2, taken: 2 });
  assert.equal(state.lastBattle?.winner, 2);
  assert.equal(state.gameStatus, 'Bob turned up the ace of hearts and wins the battle, taking 2 cards');
  // The player who flipped second starts the next battle
  assert.equal(state.currentPlayer, 2);
});

test('the next flip clears the settled battle and starts a new one', () => {
  const start = game([card('K', 'spades'), card('2', 'clubs')], [card('A', 'hearts'), card('3', 'clubs')]);
  const state = flips(start, 3);
  assert.equal(state.lastBattle, null);
  assert.deepEqual(state.battle?.cards, { 1: [], 2: [{ card: card('3', 'clubs'), faceUp: true }] });
  assert.equal(state.currentPlayer, 1);
});

test('a tie starts a war and the winner takes all six', () => {
  const alice = [card('7', 'spades'), card('2', 'clubs'), card('Q', 'clubs'), card('4', 'hearts')];
  const bob = [card('7', 'hearts'), card('3', 'diamonds'), card('J', 'diamonds'), card('5', 'hearts')];
  const tied = flips(game(alice, bob), 2);
  assert.deepEqual(tied.lastMove?.outcome, { kind: 'war' });
  assert.equal(tied.battle?.wars, 1);
  assert.equal(tied.gameStatus, 'Bob turned up the 7 of hearts: a tie, so it is war!');
  // Bob flipped second, so Bob starts the war
  assert.equal(tied.currentPlayer, 2);

  const bobWar = flip(tied);
  assert.deepEqual(bobWar.battle?.cards[2], [
    { card: card('7', 'hearts'), faceUp: true },
    { card: card('3', 'diamonds'), faceUp: false },
    { card: card('J', 'diamonds'), faceUp: true }
  ]);
  assert.equal(bobWar.gameStatus, 'Bob put a card face down and turned up the jack of diamonds');

  const settled = flip(bobWar);
  assert.deepEqual(settled.lastMove?.outcome, { kind: 'won', winner: 1, taken: 6 });
  assert.equal(settled.piles[1].length, 7);
  assert.deepEqual(settled.piles[2], [card('5', 'hearts')]);
  assert.equal(settled.gameStatus, 'Alice put a card face down and turned up the queen of clubs and wins the war, taking 6 cards');
  assert.equal(settled.currentPlayer, 1);
});

test('another tie in a war goes to another war', () => {
  const alice = [card('7', 'spades'), card('2', 'clubs'), card('Q', 'clubs'), card('2', 'hearts'), card('9', 'hearts')];
  const bob = [card('7', 'hearts'), card('3', 'diamonds'), card('Q', 'diamonds'), card('4', 'spades'), card('8', 'hearts')];
  const twice = flips(game(alice, bob), 4);
  assert.equal(twice.battle?.wars, 2);
  const settled = flips(twice, 2);
  assert.deepEqual(settled.lastMove?.outcome, { kind: 'won', winner: 1, taken: 10 });
  assert.equal(settled.lastBattle?.wars, 2);
  assert.equal(settled.isGameOver, true); // Bob has nothing left
});

test('a player out of cards during a war uses their last card face up', () => {
  const alice = [card('7', 'spades'), card('9', 'clubs')];
  const bob = [card('7', 'hearts'), card('2', 'diamonds'), card('9', 'hearts'), card('3', 'spades'), card('5', 'spades'), card('6', 'spades')];
  // The opening tie, then Bob's war; Alice has one card left, which goes face up with none face down
  const lastCard = flips(game(alice, bob), 4);
  assert.deepEqual(lastCard.battle?.cards[1], [{ card: card('7', 'spades'), faceUp: true }, { card: card('9', 'clubs'), faceUp: true }]);
  assert.equal(lastCard.lastMove?.down, 0);
  assert.equal(lastCard.gameStatus, 'Alice turned up the last card in the pile, the 9 of clubs: a tie, so it is war!');
  assert.equal(lastCard.battle?.wars, 2);
  // Alice flipped second, so she starts the next war with nothing to put in: her 9 stands
  assert.equal(lastCard.currentPlayer, 1);
  const stands = flip(lastCard);
  assert.equal(stands.lastMove?.fresh, false);
  assert.deepEqual(stands.lastMove?.up, card('9', 'clubs'));
  assert.equal(stands.gameStatus, 'Alice has no cards left, so the 9 of clubs stands');
  const settled = flip(stands);
  assert.deepEqual(settled.lastMove?.outcome, { kind: 'won', winner: 1, taken: 7 });
  assert.equal(settled.piles[1].length, 7);
  assert.deepEqual(settled.piles[2], [card('6', 'spades')]);
  assert.equal(settled.isGameOver, false);
});

test('a player whose last card loses a war loses the game', () => {
  const alice = [card('7', 'spades'), card('3', 'clubs')];
  const bob = [card('7', 'hearts'), card('2', 'diamonds'), card('K', 'hearts')];
  const state = flips(game(alice, bob), 4);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2]);
  assert.equal(state.currentPlayer, null);
});

test('both players out of cards on a tie take their own cards back', () => {
  const alice = [card('7', 'spades'), card('9', 'clubs')];
  const bob = [card('7', 'hearts'), card('9', 'hearts')];
  const state = flips(game(alice, bob), 4);
  assert.deepEqual(state.lastMove?.outcome, { kind: 'returned' });
  assert.equal(state.battle, null);
  assert.equal(state.lastBattle?.winner, null);
  assert.equal(state.piles[1].length, 2);
  assert.equal(state.piles[2].length, 2);
  assert.ok(state.piles[1].some(held => sameCard(held, card('9', 'clubs'))));
  assert.equal(state.gameStatus, 'Alice turned up the last card in the pile, the 9 of clubs: a tie, and both players are out of cards, so each takes their own cards back');
  assert.equal(state.isGameOver, false);
});

test('won cards go under the winner\'s pile in random order', () => {
  const start = game([card('A', 'spades'), card('2', 'clubs')], [card('K', 'spades'), card('3', 'clubs')]);
  const won = [card('A', 'spades'), card('K', 'spades')];
  const inOrder = flips(start, 2, noShuffle);
  assert.deepEqual(inOrder.piles[1], [card('2', 'clubs'), ...shuffle(won, noShuffle)]);
  const swapped = flips(start, 2, () => 0);
  assert.deepEqual(swapped.piles[1], [card('2', 'clubs'), ...shuffle(won, () => 0)]);
  assert.notDeepEqual(inOrder.piles[1], swapped.piles[1]);
});

test('game ends when one player has all 52', () => {
  const deck = standardDeck();
  const last = card('K', 'spades');
  const rest = deck.filter(held => !sameCard(held, last) && !sameCard(held, card('A', 'spades')));
  const state = flips(game([card('A', 'spades'), ...rest], [last]), 2);
  assert.equal(state.piles[1].length, 52);
  assert.equal(state.piles[2].length, 0);
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.gameStatus, 'Bob turned up the king of spades and Alice wins the battle, taking 2 cards. Alice has all 52 cards and wins!');
  assert.deepEqual(applyMove(war, state, 1, FLIP, noShuffle), { error: 'The game is over' });
});

test('a whole seeded game keeps all 52 cards and ends with one player holding them', () => {
  let state = lobby('Alice', 'Bob');
  const random = seeded(3);
  for (let moves = 0; !state.isGameOver && moves < 20000; moves++) {
    state = flip(state, random);
    assert.equal(total(state), 52);
  }
  assert.equal(state.isGameOver, true);
  const winner = state.winners[0];
  assert.equal(state.piles[winner].length, 52);
});

test('invalid moves', () => {
  const start = game([card('K', 'spades')], [card('A', 'hearts')]);
  const copy = structuredClone(start);
  for (const move of [null, 'flip', 42, {}, { type: 'shout' }, [FLIP]]) {
    assert.deepEqual(rulesMove(start, 1, move, noShuffle), { error: 'Invalid move' });
  }
  assert.deepEqual(rulesMove(start, 3, FLIP, noShuffle), { error: 'You are not in this game' });
  const flipped = ok(rulesMove(start, 1, FLIP, noShuffle));
  assert.deepEqual(rulesMove(flipped, 1, FLIP, noShuffle), { error: 'You already flipped this round' });
  assert.deepEqual(applyMove(war, start, 2, FLIP, noShuffle), { error: 'Not your turn' });
  assert.deepEqual(start, copy);
});

test('dismissed player mid-turn', () => {
  // Bob holds the turn after Alice's flip, then disconnects and is dismissed: the game ends at once
  const flipped = flip(lobby('Alice', 'Bob'));
  assert.equal(flipped.currentPlayer, 2);
  const held = disconnectPlayer(war, flipped, 2);
  const dismissed = removePlayer(war, held, 2);
  assert.equal(dismissed.isGameOver, true);
  assert.deepEqual(dismissed.winners, [1]);
  assert.equal(dismissed.currentPlayer, null);
  const view = war.toPublicState(dismissed, false, null);
  assert.equal(view.pileCounts[1], 25);
  assert.deepEqual(applyMove(war, dismissed, 1, FLIP, noShuffle), { error: 'The game is over' });
});

test('table view hides hands', () => {
  let state = lobby('Alice', 'Bob');
  const random = seeded(11);
  let sawFaceDown = false;
  for (let moves = 0; moves < 120 && !state.isGameOver; moves++) {
    for (const viewer of [null, 1, 2]) {
      const view: Omit<PublicGameState, 'moveCount'> = war.toPublicState(state, false, viewer);
      const json = JSON.stringify(view);
      assert.equal('piles' in view, false);
      assert.deepEqual(view.pileCounts, { 1: state.piles[1].length, 2: state.piles[2].length });
      // A face-down card shows as null and its face appears nowhere in the view
      const laid = [state.battle, state.lastBattle].flatMap(battle => Object.values(battle?.cards ?? {}).flat());
      for (const { card: hidden, faceUp } of laid) {
        if (faceUp) continue;
        sawFaceDown = true;
        assert.equal(json.includes(JSON.stringify(hidden)), false);
      }
      for (const [seat, cards] of Object.entries(view.battle?.cards ?? {})) {
        const full = state.battle?.cards[Number(seat)] ?? [];
        assert.deepEqual(cards, full.map(laidCard => laidCard.faceUp ? laidCard.card : null));
      }
    }
    state = flip(state, random);
  }
  assert.equal(sawFaceDown, true, 'expected the short game to have a war');
});
