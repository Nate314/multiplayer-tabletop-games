import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, GEMS, NOBLES, gems } from './cards.ts';
import { bonuses, createGameState, payment, prestige, toPublicState } from './rules.ts';
import { splendor } from './index.ts';
import { addPlayer, applyMove, removePlayer } from '../../shared/seating.ts';
import type { GameState, Gem, Level, PlayerState, Result, Tokens } from './types.ts';

// The same deal on every run
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seatedGame(count: number, seed = 1): GameState {
  const random = seeded(seed);
  let state = createGameState('g1');
  for (let i = 0; i < count; i++) {
    const result = addPlayer(splendor, state, `P${i + 1}`, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

function ok(result: Result<GameState>): GameState {
  if ('error' in result) assert.fail(result.error);
  return result.state;
}

function move(state: GameState, seat: number, input: unknown): GameState {
  return ok(applyMove(splendor, state, seat, input, seeded(9)));
}

function tokens(partial: Partial<Tokens> = {}): Tokens {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0, ...partial };
}

function withPlayer(state: GameState, seat: number, change: Partial<PlayerState>): GameState {
  return { ...state, players: { ...state.players, [seat]: { ...state.players[seat], ...change } } };
}

// Puts `card` face up in the first slot of its level, swapping it with whatever was there
function withMarketCard(state: GameState, card: number): GameState {
  const level = CARDS[card].level;
  const first = state.market[level][0];
  const swap = (id: number | null) => (id === card ? first : id);
  const decks = { ...state.decks, [level]: state.decks[level].map(id => swap(id) as number) };
  const market = { ...state.market, [level]: [card, ...state.market[level].slice(1).map(swap)] };
  return { ...state, decks, market };
}

// Cards of one bonus color, to build bonuses with
function cardsOf(color: Gem, count: number): number[] {
  return CARDS.filter(card => card.bonus === color).slice(0, count).map(card => card.id);
}

const sum = (record: Record<string, number>) => Object.values(record).reduce((a, b) => a + b, 0);

test('the published lists: 40 level 1, 30 level 2, 20 level 3 and 10 nobles', () => {
  assert.equal(CARDS.length, 90);
  const byLevel = (level: Level) => CARDS.filter(card => card.level === level);
  assert.equal(byLevel(1).length, 40);
  assert.equal(byLevel(2).length, 30);
  assert.equal(byLevel(3).length, 20);
  for (const color of GEMS) {
    assert.equal(byLevel(1).filter(card => card.bonus === color).length, 8);
    assert.equal(byLevel(2).filter(card => card.bonus === color).length, 6);
    assert.equal(byLevel(3).filter(card => card.bonus === color).length, 4);
  }
  assert.equal(NOBLES.length, 10);
  assert.ok(NOBLES.every(noble => noble.points === 3 && (sum(noble.cost) === 8 || sum(noble.cost) === 9)));
  assert.equal(CARDS.reduce((total, card) => total + card.points, 0), 5 + 5 * (1 + 1 + 2 + 2 + 2 + 3) + 5 * (3 + 4 + 4 + 5));
  assert.deepEqual(CARDS[89], { id: 89, level: 3, bonus: 'black', points: 5, cost: gems(0, 0, 0, 7, 3) });
});

test('token counts are 4, 5 and 7 per color for 2, 3 and 4 players, and 5 gold', () => {
  for (const [players, each] of [[2, 4], [3, 5], [4, 7]]) {
    const { supply } = seatedGame(players);
    for (const color of GEMS) assert.equal(supply[color], each);
    assert.equal(supply.gold, 5);
  }
});

test('nobles are players plus one, and four cards face up per level', () => {
  for (const players of [2, 3, 4]) {
    const state = seatedGame(players);
    assert.equal(state.nobles.length, players + 1);
    for (const level of [1, 2, 3] as Level[]) {
      assert.equal(state.market[level].length, 4);
      assert.equal(state.decks[level].length, [40, 30, 20][level - 1] - 4);
    }
  }
});

test('take three different colors, or fewer only when fewer colors remain', () => {
  let state = seatedGame(2);
  state = move(state, 1, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  assert.deepEqual(state.players[1].tokens, tokens({ white: 1, blue: 1, green: 1 }));
  assert.equal(state.supply.white, 3);
  assert.equal(state.currentPlayer, 2);
  assert.ok('error' in applyMove(splendor, state, 2, { type: 'takeThree', colors: ['red', 'black'] }, Math.random));
  assert.ok('error' in applyMove(splendor, state, 2, { type: 'takeThree', colors: ['red', 'red', 'black'] }, Math.random));

  const scarce = { ...state, supply: tokens({ red: 2, black: 1, gold: 5 }) };
  const taken = move(scarce, 2, { type: 'takeThree', colors: ['red', 'black'] });
  assert.deepEqual(taken.players[2].tokens, tokens({ red: 1, black: 1 }));
});

test('take two needs 4 left of that color', () => {
  let state = seatedGame(2);
  state = move(state, 1, { type: 'takeTwo', color: 'red' });
  assert.equal(state.players[1].tokens.red, 2);
  assert.equal(state.supply.red, 2);
  const result = applyMove(splendor, state, 2, { type: 'takeTwo', color: 'red' }, Math.random);
  assert.deepEqual(result, { error: 'Taking two needs at least 4 of that color left' });
  assert.ok('error' in applyMove(splendor, state, 2, { type: 'takeTwo', color: 'gold' }, Math.random));
});

test('reserve gives a gold when any is left and caps at 3 reserved', () => {
  let state = seatedGame(2);
  const faceUp = state.market[1][2];
  state = move(state, 1, { type: 'reserve', source: { kind: 'market', level: 1, slot: 2 } });
  assert.deepEqual(state.players[1].reserved, [{ card: faceUp, fromDeck: false }]);
  assert.equal(state.players[1].tokens.gold, 1);
  assert.equal(state.supply.gold, 4);
  assert.notEqual(state.market[1][2], faceUp);
  assert.equal(state.decks[1].length, 35);

  const top = state.decks[3].at(-1);
  state = move(state, 2, { type: 'reserve', source: { kind: 'deck', level: 3 } });
  assert.deepEqual(state.players[2].reserved, [{ card: top, fromDeck: true }]);
  assert.deepEqual(state.lastMove, { seat: 2, noble: null, type: 'reserve', level: 3, card: null, gold: true });

  const noGold = { ...state, supply: { ...state.supply, gold: 0 } };
  const reserved = move(noGold, 1, { type: 'reserve', source: { kind: 'market', level: 2, slot: 0 } });
  assert.equal(reserved.players[1].tokens.gold, 1);
  assert.equal(reserved.players[1].reserved.length, 2);

  const full = withPlayer(state, 1, { reserved: [0, 1, 2].map(card => ({ card, fromDeck: false })) });
  assert.deepEqual(
    applyMove(splendor, full, 1, { type: 'reserve', source: { kind: 'deck', level: 1 } }, Math.random),
    { error: 'You already have 3 reserved cards' }
  );
});

test('bonuses discount costs and gold pays any shortfall', () => {
  // Level 2 white, 2 prestige: 1 green, 4 red, 2 black
  const card = CARDS.findIndex(c => c.level === 2 && c.bonus === 'white' && c.cost.red === 4);
  const player: PlayerState = { tokens: tokens({ green: 1, red: 2, gold: 1 }), cards: [...cardsOf('red', 1), ...cardsOf('black', 2)], reserved: [], nobles: [] };
  assert.deepEqual(bonuses(player), gems(0, 0, 0, 1, 2));
  assert.deepEqual(payment(player, CARDS[card]), tokens({ green: 1, red: 2, gold: 1 }));
  assert.equal(payment({ ...player, tokens: tokens({ green: 1, red: 2 }) }, CARDS[card]), null);

  let state = withMarketCard(seatedGame(2), card);
  state = withPlayer(state, 1, player);
  const supplyBefore = state.supply;
  state = move(state, 1, { type: 'buy', source: { kind: 'market', level: 2, slot: 0 } });
  assert.deepEqual(state.players[1].tokens, tokens());
  assert.ok(state.players[1].cards.includes(card));
  assert.equal(state.supply.gold, supplyBefore.gold + 1);
  assert.equal(state.supply.red, supplyBefore.red + 2);
  assert.notEqual(state.market[2][0], card);
  assert.equal(prestige(state.players[1]), 2);
});

test('a reserved card is bought from the reserve, and a card you cannot afford is refused', () => {
  let state = seatedGame(2);
  state = move(state, 1, { type: 'reserve', source: { kind: 'deck', level: 1 } });
  const card = state.players[1].reserved[0].card;
  state = move(state, 2, { type: 'takeTwo', color: 'red' });
  assert.deepEqual(
    applyMove(splendor, state, 1, { type: 'buy', source: { kind: 'market', level: 3, slot: 0 } }, Math.random),
    { error: 'You cannot afford that card' }
  );
  state = withPlayer(state, 1, { tokens: tokens({ white: 4, blue: 4, green: 4, red: 4, black: 4 }) });
  state = move(state, 1, { type: 'buy', source: { kind: 'reserved', index: 0 } });
  assert.deepEqual(state.players[1].reserved, []);
  assert.deepEqual(state.players[1].cards, [card]);
  assert.deepEqual(state.lastMove && state.lastMove.type === 'buy' && state.lastMove.fromReserve, true);
});

test('over 10 tokens returns down to 10 before the turn passes', () => {
  let state = withPlayer(seatedGame(2), 1, { tokens: tokens({ white: 3, blue: 3, green: 3 }) });
  state = move(state, 1, { type: 'takeThree', colors: ['red', 'black', 'white'] });
  assert.deepEqual(state.pending, { kind: 'returnTokens', count: 2 });
  assert.equal(state.currentPlayer, 1);
  assert.deepEqual(
    applyMove(splendor, state, 1, { type: 'takeTwo', color: 'green' }, Math.random),
    { error: 'Return tokens down to 10 first' }
  );
  assert.deepEqual(
    applyMove(splendor, state, 1, { type: 'returnTokens', tokens: { white: 1 } }, Math.random),
    { error: 'Return exactly 2 tokens' }
  );
  assert.ok('error' in applyMove(splendor, state, 1, { type: 'returnTokens', tokens: { gold: 2 } }, Math.random));
  const supplyWhite = state.supply.white;
  state = move(state, 1, { type: 'returnTokens', tokens: { white: 1, black: 1 } });
  assert.equal(sum(state.players[1].tokens), 10);
  assert.equal(state.supply.white, supplyWhite + 1);
  assert.equal(state.pending, null);
  assert.equal(state.currentPlayer, 2);
});

test('a qualifying noble visits at the end of the turn, one per turn, chosen when several', () => {
  // Noble 6 wants 3 white, 3 blue, 3 green; noble 2 wants 4 white and 4 blue
  const base = { ...seatedGame(2), nobles: [6, 2, 0] };
  const cards = [...cardsOf('white', 4), ...cardsOf('blue', 4), ...cardsOf('green', 3)];
  let state = withPlayer(base, 1, { cards });
  state = move(state, 1, { type: 'takeThree', colors: ['red', 'black', 'white'] });
  assert.deepEqual(state.pending, { kind: 'chooseNoble', nobles: [6, 2] });
  assert.equal(state.currentPlayer, 1);
  assert.ok('error' in applyMove(splendor, state, 1, { type: 'chooseNoble', noble: 0 }, Math.random));
  state = move(state, 1, { type: 'chooseNoble', noble: 2 });
  assert.deepEqual(state.players[1].nobles, [2]);
  assert.deepEqual(state.nobles, [6, 0]);
  assert.equal(state.currentPlayer, 2);

  state = move(state, 2, { type: 'takeThree', colors: ['red', 'black', 'white'] });
  // The other qualifying noble visits on a later turn, by itself
  state = move(state, 1, { type: 'takeThree', colors: ['red', 'black', 'blue'] });
  assert.deepEqual(state.players[1].nobles, [2, 6]);
  assert.equal(state.lastMove?.noble, 6);
  assert.equal(prestige(state.players[1]), 6 + cards.reduce((total, id) => total + CARDS[id].points, 0));
});

const FIVES = CARDS.filter(card => card.points === 5).map(card => card.id);
const FOURS = CARDS.filter(card => card.points === 4).map(card => card.id);
const ONE = CARDS.find(card => card.level === 1 && card.points === 1)?.id ?? -1;

test('reaching 15 finishes the round, most prestige wins, ties go to fewest cards', () => {
  let state = seatedGame(3);
  state = withPlayer(state, 2, { cards: FIVES.slice(0, 3) });
  state = withPlayer(state, 3, { cards: [FIVES[3], FIVES[4], FOURS[0], ONE] });
  state = move(state, 1, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  assert.equal(state.finalRound, false);
  state = move(state, 2, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  assert.equal(state.finalRound, true);
  assert.equal(state.isGameOver, false);
  assert.equal(state.currentPlayer, 3);
  state = move(state, 3, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  assert.equal(state.isGameOver, true);
  assert.equal(state.currentPlayer, null);
  assert.equal(prestige(state.players[2]), 15);
  assert.equal(prestige(state.players[3]), 15);
  assert.deepEqual(state.winners, [2]);
});

test('a tie on prestige and cards goes to fewest reserved, then is shared', () => {
  let state = seatedGame(2);
  state = withPlayer(state, 1, { cards: FIVES.slice(0, 3) });
  state = withPlayer(state, 2, { cards: FOURS.slice(0, 3), nobles: [9] });
  assert.equal(prestige(state.players[2]), 15);
  state = move(state, 1, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  const tied = move(state, 2, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  assert.deepEqual(tied.winners, [1, 2]);

  const reserving = move(state, 2, { type: 'reserve', source: { kind: 'deck', level: 1 } });
  assert.deepEqual(reserving.winners, [1]);
});

test('a player with no legal action may pass, and only then', () => {
  let state = seatedGame(2);
  assert.deepEqual(applyMove(splendor, state, 1, { type: 'pass' }, Math.random), { error: 'You can still take an action' });
  state = {
    ...state,
    supply: tokens(),
    decks: { 1: [], 2: [], 3: [] },
    market: { 1: [null, null, null, null], 2: [null, null, null, null], 3: [null, null, null, null] }
  };
  state = move(state, 1, { type: 'pass' });
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.lastMove, { seat: 1, noble: null, type: 'pass' });
});

test('an empty deck leaves its slot empty and cannot be reserved from', () => {
  let state = seatedGame(2);
  state = { ...state, decks: { ...state.decks, 3: [] } };
  state = move(state, 1, { type: 'reserve', source: { kind: 'market', level: 3, slot: 1 } });
  assert.equal(state.market[3][1], null);
  assert.deepEqual(
    applyMove(splendor, state, 2, { type: 'reserve', source: { kind: 'deck', level: 3 } }, Math.random),
    { error: 'That deck is empty' }
  );
  assert.deepEqual(
    applyMove(splendor, state, 2, { type: 'buy', source: { kind: 'market', level: 3, slot: 1 } }, Math.random),
    { error: 'There is no card there' }
  );
});

test('invalid moves', () => {
  const state = seatedGame(2);
  const bad: unknown[] = [
    null, 42, 'buy', {}, { type: 'nonsense' },
    { type: 'takeThree' }, { type: 'takeThree', colors: 'red' }, { type: 'takeThree', colors: ['red', 'pink', 'blue'] },
    { type: 'takeThree', colors: ['gold', 'red', 'blue'] }, { type: 'takeThree', colors: [] },
    { type: 'takeThree', colors: ['red', 'blue', 'green', 'white'] },
    { type: 'takeTwo', color: 7 },
    { type: 'reserve' }, { type: 'reserve', source: { kind: 'market', level: 4, slot: 0 } },
    { type: 'reserve', source: { kind: 'market', level: 1, slot: 4 } },
    { type: 'reserve', source: { kind: 'market', level: 1, slot: -1 } },
    { type: 'reserve', source: { kind: 'market', level: 1, slot: 1.5 } },
    { type: 'reserve', source: { kind: 'reserved', index: 0 } },
    { type: 'buy', source: { kind: 'deck', level: 1 } },
    { type: 'buy', source: { kind: 'reserved', index: 0 } },
    { type: 'returnTokens', tokens: { red: 1 } },
    { type: 'chooseNoble', noble: 0 }
  ];
  for (const input of bad) {
    const result = applyMove(splendor, state, 1, input, Math.random);
    assert.ok('error' in result, `expected an error for ${JSON.stringify(input)}`);
  }
  const pending: GameState = { ...withPlayer(state, 1, { tokens: tokens({ red: 4, blue: 4, green: 3 }) }), pending: { kind: 'returnTokens', count: 1 } };
  for (const input of [
    { type: 'returnTokens', tokens: { red: -1, blue: 2 } },
    { type: 'returnTokens', tokens: { red: 0.5, blue: 0.5 } },
    { type: 'returnTokens', tokens: { white: 1 } },
    { type: 'returnTokens', tokens: { pink: 1 } },
    { type: 'returnTokens', tokens: null }
  ]) {
    assert.ok('error' in applyMove(splendor, pending, 1, input, Math.random), JSON.stringify(input));
  }
  assert.deepEqual(applyMove(splendor, state, 2, { type: 'takeTwo', color: 'red' }, Math.random), { error: 'Not your turn' });
  assert.deepEqual(applyMove(splendor, state, 5, { type: 'takeTwo', color: 'red' }, Math.random), { error: 'Not your turn' });
});

test('dismissed player mid-turn: the pending step is dropped, their tokens go back and play moves on', () => {
  let state = withPlayer(seatedGame(3), 2, { tokens: tokens({ white: 3, blue: 3, green: 3 }) });
  state = move(state, 1, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  state = move(state, 2, { type: 'takeThree', colors: ['red', 'black', 'white'] });
  assert.equal(state.pending?.kind, 'returnTokens');
  const supplyBefore = state.supply;
  const held = state.players[2].tokens;
  state = removePlayer(splendor, state, 2, seeded(3));
  assert.equal(state.pending, null);
  assert.equal(state.currentPlayer, 3);
  assert.deepEqual(state.activePlayers, [1, 3]);
  for (const color of GEMS) assert.equal(state.supply[color], supplyBefore[color] + held[color]);
  state = move(state, 3, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  assert.equal(state.currentPlayer, 1);
});

test('dismissing the last player of a final round ends the game', () => {
  const strong = CARDS.filter(card => card.points === 5).map(card => card.id);
  let state = withPlayer(seatedGame(3), 1, { cards: strong.slice(0, 3) });
  state = move(state, 1, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  assert.equal(state.finalRound, true);
  state = move(state, 2, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  state = removePlayer(splendor, state, 3, seeded(3));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
});

test('table view hides hands: no deck order and no card reserved unseen', () => {
  let state = seatedGame(2);
  const steps: GameState[] = [state];
  state = move(state, 1, { type: 'reserve', source: { kind: 'deck', level: 2 } });
  steps.push(state);
  state = move(state, 2, { type: 'reserve', source: { kind: 'market', level: 1, slot: 0 } });
  steps.push(state);
  state = move(state, 1, { type: 'takeThree', colors: ['white', 'blue', 'green'] });
  steps.push(state);
  const hidden = state.players[1].reserved[0].card;
  const shown = state.players[2].reserved[0].card;
  for (const step of steps) {
    const view = toPublicState(step, false, null);
    assert.equal('decks' in view, false);
    assert.equal('turnHolder' in view, false);
    const named = new RegExp(`"card":${hidden}\\b`);
    assert.equal(named.test(JSON.stringify(view.players)), false);
    assert.equal(named.test(JSON.stringify(view.lastMove)), false);
    assert.deepEqual(view.deckCounts, { 1: step.decks[1].length, 2: step.decks[2].length, 3: step.decks[3].length });
  }
  const table = toPublicState(state, false, null);
  assert.deepEqual(table.players[1].reserved, [{ level: 2, card: null }]);
  assert.deepEqual(table.players[2].reserved, [{ level: 1, card: shown }]);
  assert.deepEqual(toPublicState(state, false, 2).players[1].reserved, [{ level: 2, card: null }]);
  assert.deepEqual(toPublicState(state, false, 1).players[1].reserved, [{ level: 2, card: hidden }]);
});
