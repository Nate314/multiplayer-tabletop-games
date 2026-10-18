import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, removePlayer } from '../../shared/seating.ts';
import { compareDice } from './battle.ts';
import { isSet, setValue } from './cards.ts';
import { NEIGHBORS, WILD_CARDS, territoriesOf, territoryName } from './map.ts';
import { connectedTerritories } from './placement.ts';
import { createGameState, toPublicState } from './rules.ts';
import { reinforcementsFor, territoriesHeld } from './state.ts';
import { risk } from './index.ts';
import { IDS, dice, fourPlayers, game, move, ownership, played } from './testing.ts';
import type { GameState, Random, Seat } from './types.ts';

function lobby(count: number, random: Random = () => 0): GameState {
  let state = createGameState('g');
  for (const name of ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Finn'].slice(0, count)) {
    const result = addPlayer(risk, state, name, random);
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

const held = (state: GameState, seat: Seat) => territoriesHeld(state, seat).length;
const totalArmies = (state: GameState, seat: Seat) => territoriesHeld(state, seat).reduce((sum, id) => sum + state.armies[id], 0);

// Alice in her attack phase with the test map
const attacking = (overrides: Partial<GameState> = {}) => game({ phase: 'attack', reinforcements: 0, ...overrides });

test('setup deals every territory with one army, and the starting armies follow the player count', () => {
  const expected: Record<number, [number, number[]]> = {
    3: [35, [14, 14, 14]], 4: [30, [11, 11, 10, 10]], 5: [25, [9, 9, 8, 8, 8]], 6: [20, [7, 7, 7, 7, 7, 7]]
  };
  for (const [count, [armies, territories]] of Object.entries(expected)) {
    const state = lobby(Number(count));
    assert.equal(state.phase, 'setup');
    assert.equal(state.firstPlayer, 1); // random 0 picks the first seat
    assert.equal(state.currentPlayer, 1);
    assert.equal(Object.keys(state.owners).length, 42);
    assert.ok(Object.values(state.armies).every(value => value === 1));
    assert.deepEqual(state.activePlayers.map(seat => held(state, seat)), territories);
    for (const seat of state.activePlayers) assert.equal(state.setupLeft[seat] + held(state, seat), armies);
    assert.equal(state.deck.length, 44);
  }
});

test('with fewer than three players nothing is dealt and no move is allowed', () => {
  const state = lobby(2);
  assert.deepEqual(state.owners, {});
  assert.equal(state.firstPlayer, null);
  assert.deepEqual(move(state, 1, { type: 'endTurn' }), { error: 'Waiting for more players' });
});

test('the first player is drawn at random, and the deal starts with them', () => {
  const state = lobby(4, () => 0.99); // random near 1 picks the last seat
  assert.equal(state.firstPlayer, 4);
  assert.equal(state.currentPlayer, 4);
  assert.deepEqual([4, 1, 2, 3].map(seat => held(state, seat)), [11, 11, 10, 10]);
});

test('each player places all their starting armies in one move, then the first player begins', () => {
  let state = lobby(3);
  const mine = territoriesHeld(state, 1);
  assert.deepEqual(move(state, 1, { type: 'place', placements: { [mine[0]]: 20 } }), { error: 'Place all 21 armies you have left' });
  assert.deepEqual(move(state, 1, { type: 'place', placements: { [territoriesHeld(state, 2)[0]]: 21 } }), { error: `You do not hold ${territoryName(territoriesHeld(state, 2)[0])}` });
  assert.deepEqual(move(state, 1, { type: 'endTurn' }), { error: 'Place your starting armies first' });
  state = played(state, 1, { type: 'place', placements: { [mine[0]]: 11, [mine[1]]: 10 } });
  assert.equal(state.armies[mine[0]], 12);
  assert.equal(state.setupLeft[1], 0);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.phase, 'setup');
  state = played(state, 2, { type: 'place', placements: { [territoriesHeld(state, 2)[0]]: 21 } });
  state = played(state, 3, { type: 'place', placements: { [territoriesHeld(state, 3)[0]]: 21 } });
  assert.equal(state.phase, 'reinforce');
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.turnNumber, 1);
  assert.equal(state.reinforcements, reinforcementsFor(state, 1));
  for (const seat of [1, 2, 3]) assert.equal(totalArmies(state, seat), 35);
});

test('reinforcements: a third of the territories, at least 3, plus whole continents', () => {
  const base = game();
  assert.equal(reinforcementsFor(base, 1), 4); // 14 territories
  assert.equal(reinforcementsFor({ owners: ownership(2, { alaska: 1 }) }, 1), 3);
  assert.equal(reinforcementsFor({ owners: ownership(2, Object.fromEntries(territoriesOf('australia').map(id => [id, 1]))) }, 1), 3 + 2);
  const asia = Object.fromEntries([...territoriesOf('asia'), ...territoriesOf('southAmerica')].map(id => [id, 1]));
  assert.equal(reinforcementsFor({ owners: ownership(2, asia) }, 1), 5 + 7 + 2);
  assert.equal(reinforcementsFor({ owners: ownership(1, { alaska: 2 }) }, 1), 13 + 2 + 5 + 3 + 7 + 2);
});

test('placing reinforcements in parts, then the attack phase begins', () => {
  let state = game();
  assert.deepEqual(move(state, 1, { type: 'place', placements: { alaska: 4 } }), { error: 'You have only 3 armies to place' });
  assert.deepEqual(move(state, 1, { type: 'place', placements: { northwestTerritory: 1 } }), { error: 'You do not hold Northwest Territory' });
  assert.deepEqual(move(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 1 }), { error: 'You can attack only in the attack phase' });
  assert.deepEqual(move(state, 1, { type: 'endTurn' }), { error: 'You cannot end your turn yet' });
  state = played(state, 1, { type: 'place', placements: { alaska: 1 } });
  assert.equal(state.reinforcements, 2);
  assert.equal(state.phase, 'reinforce');
  state = played(state, 1, { type: 'place', placements: { alaska: 1, alberta: 1 } });
  assert.equal(state.armies.alaska, 5);
  assert.equal(state.armies.alberta, 4);
  assert.equal(state.phase, 'attack');
  assert.equal(state.lastMove?.events[0], 'Alice placed 1 on Alaska, 1 on Alberta');
  assert.deepEqual(state.lastMove?.territories, ['alaska', 'alberta']);
});

test('sets: three alike, one of each, or any two with a wild', () => {
  const [wild, otherWild] = WILD_CARDS;
  assert.equal(isSet([0, 3, 6]), true); // three infantry
  assert.equal(isSet([0, 1, 2]), true); // one of each
  assert.equal(isSet([0, 3, wild]), true);
  assert.equal(isSet([0, 1, wild]), true);
  assert.equal(isSet([0, wild, otherWild]), true);
  assert.equal(isSet([0, 3, 1]), false);
  assert.equal(isSet([0, 3]), false);
});

test('set values escalate 4, 6, 8, 10, 12, 15, then 5 more each', () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, traded) => setValue(traded)), [4, 6, 8, 10, 12, 15, 20, 25, 30]);
});

test('trading a set adds its armies, and 2 more on a held territory shown on a card, once a turn', () => {
  // Cards 0 (Alaska), 3 (Alberta), 6 (Western United States): infantry, all Alice's; 9, 12, 15 likewise
  let state = game({ hands: { 1: [0, 3, 6, 9, 12, 15], 2: [], 3: [] }, tradeCount: 5 });
  assert.deepEqual(move(state, 1, { type: 'trade', cards: [0, 3, 1] }), { error: 'Choose three of your cards' });
  assert.deepEqual(move(state, 1, { type: 'trade', cards: [0, 0, 3] }), { error: 'Choose three of your cards' });
  state = played(state, 1, { type: 'trade', cards: [0, 3, 6] });
  assert.equal(state.reinforcements, 3 + 15);
  assert.equal(state.armies.alaska, 5);
  assert.equal(state.tradeCount, 6);
  assert.deepEqual(state.hands[1], [9, 12, 15]);
  assert.deepEqual(state.discard, [0, 3, 6]);
  state = played(state, 1, { type: 'trade', cards: [9, 12, 15] });
  assert.equal(state.reinforcements, 3 + 15 + 20);
  assert.equal(state.armies.venezuela, 3); // no second bonus this turn
  assert.deepEqual(state.hands[1], []);
});

test('the bonus goes only to a territory the trader holds', () => {
  // Cards 1, 4, 7 show Bob's territories
  const state = played(game({ hands: { 1: [1, 4, 7], 2: [], 3: [] } }), 1, { type: 'trade', cards: [1, 4, 7] });
  assert.equal(state.reinforcements, 3 + 4);
  assert.equal(state.bonusTaken, false);
  assert.ok(IDS.every(id => state.armies[id] === 3));
});

test('holding 5 cards at the start of the turn forces a trade before placing', () => {
  let state = game({ hands: { 1: [1, 4, 7, 10, 13], 2: [], 3: [] } });
  assert.deepEqual(move(state, 1, { type: 'place', placements: { alaska: 3 } }), { error: 'You hold 5 or more cards: trade a set first' });
  state = played(state, 1, { type: 'trade', cards: [1, 4, 7] });
  state = played(state, 1, { type: 'place', placements: { alaska: 7 } });
  assert.equal(state.phase, 'attack');
  assert.deepEqual(move(state, 1, { type: 'trade', cards: [10, 13, WILD_CARDS[0]] }), { error: 'Trade cards while placing armies, at the start of your turn' });
});

test('dice: highest pairs compared, ties to the defender', () => {
  assert.deepEqual(compareDice([6, 5, 1], [5, 5]), { attackerLost: 1, defenderLost: 1 });
  assert.deepEqual(compareDice([6, 6, 6], [6]), { attackerLost: 1, defenderLost: 0 });
  assert.deepEqual(compareDice([2], [1, 1]), { attackerLost: 0, defenderLost: 1 });
  assert.deepEqual(compareDice([4, 3], [3, 2]), { attackerLost: 0, defenderLost: 2 });
});

test('an attack rolls the chosen dice against up to 2, and one army must stay behind', () => {
  let state = attacking();
  assert.deepEqual(move(state, 1, { type: 'attack', from: 'alaska', to: 'northwestTerritory', dice: 3 }), { error: 'Roll 1 to 2 dice' });
  assert.deepEqual(move(state, 1, { type: 'attack', from: 'alaska', to: 'greenland', dice: 1 }), { error: 'Alaska does not border Greenland' });
  assert.deepEqual(move(state, 1, { type: 'attack', from: 'alaska', to: 'alberta', dice: 1 }), { error: 'You cannot attack your own territory' });
  assert.deepEqual(move(state, 1, { type: 'attack', from: 'kamchatka', to: 'alaska', dice: 1 }), { error: 'Attack from a territory you hold' });
  assert.deepEqual(move({ ...state, armies: { ...state.armies, alaska: 1 } }, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 1 }),
    { error: 'You need at least 2 armies to attack, as one must stay behind' });

  state = played(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 2 }, dice(3, 5, 4, 5));
  assert.deepEqual(state.battle?.attackDice, [5, 3]);
  assert.deepEqual(state.battle?.defendDice, [5, 4]);
  assert.equal(state.armies.alaska, 1);
  assert.equal(state.armies.kamchatka, 3);
  assert.equal(state.phase, 'attack');

  const oneDefender = attacking({ armies: { ...state.armies, alaska: 4, kamchatka: 1 } });
  const won = played(oneDefender, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 3 }, dice(1, 1, 2, 3));
  assert.deepEqual(won.battle?.defendDice, [3]); // one die for one army
  assert.equal(won.armies.alaska, 3);
  assert.equal(won.owners.kamchatka, 3);
});

test('a conquest moves at least the dice rolled, then attacks go on', () => {
  let state = attacking({ armies: { ...game().armies, alaska: 5, kamchatka: 1 } });
  state = played(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 3 }, dice(6, 1, 1, 2));
  assert.equal(state.owners.kamchatka, 1);
  assert.equal(state.phase, 'conquer');
  assert.deepEqual(state.conquest, { from: 'alaska', to: 'kamchatka', minimum: 3 });
  assert.equal(state.conqueredThisTurn, true);
  assert.deepEqual(move(state, 1, { type: 'endTurn' }), { error: 'Move armies into the captured territory first' });
  assert.deepEqual(move(state, 1, { type: 'occupy', armies: 2 }), { error: 'Move 3 to 4 armies' });
  assert.deepEqual(move(state, 1, { type: 'occupy', armies: 5 }), { error: 'Move 3 to 4 armies' });
  state = played(state, 1, { type: 'occupy', armies: 4 });
  assert.equal(state.armies.alaska, 1);
  assert.equal(state.armies.kamchatka, 4);
  assert.equal(state.phase, 'attack');
  assert.deepEqual(move(state, 1, { type: 'occupy', armies: 1 }), { error: 'There is no captured territory to move into' });
});

test('blitz rolls the most dice until the territory falls or one army is left', () => {
  const start = attacking({ armies: { ...game().armies, alaska: 10, kamchatka: 2 } });
  const won = played(start, 1, { type: 'blitz', from: 'alaska', to: 'kamchatka' }, dice(6, 6, 6, 1, 1));
  assert.equal(won.phase, 'conquer');
  assert.equal(won.battle?.rolls, 1);
  assert.deepEqual(won.conquest?.minimum, 3);

  const lost = played(attacking({ armies: { ...game().armies, alaska: 4, kamchatka: 5 } }), 1, { type: 'blitz', from: 'alaska', to: 'kamchatka' });
  assert.equal(lost.armies.alaska, 1);
  assert.equal(lost.owners.kamchatka, 3);
  assert.equal(lost.battle?.attackerLost, 3);
  assert.equal(lost.battle?.rolls, 2); // 3 dice against 2 loses 2, then 1 die against 2 loses 1
  assert.equal(lost.phase, 'attack');
});

test('a card is drawn at the end of a turn with a conquest, and only then', () => {
  let state = attacking({ armies: { ...game().armies, alaska: 5, kamchatka: 1 } });
  const quiet = played(state, 1, { type: 'endTurn' });
  assert.deepEqual(quiet.hands[1], []);
  assert.equal(quiet.currentPlayer, 2);
  assert.equal(quiet.phase, 'reinforce');

  state = played(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 3 }, dice(6, 1, 1, 2));
  state = played(state, 1, { type: 'occupy', armies: 3 });
  state = played(state, 1, { type: 'endTurn' });
  assert.deepEqual(state.hands[1], [0]);
  assert.equal(state.deck.length, 43);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.reinforcements, reinforcementsFor(state, 2));
  assert.equal(state.conqueredThisTurn, false);
});

test('an empty deck is refilled from the discards, and with none anywhere no card is drawn', () => {
  const conquered = attacking({ conqueredThisTurn: true, deck: [], discard: [5, 6, 7] });
  const drawn = played(conquered, 1, { type: 'endTurn' });
  assert.equal(drawn.hands[1].length, 1);
  assert.equal(drawn.deck.length + drawn.discard.length, 2);
  const none = played(attacking({ conqueredThisTurn: true, deck: [], discard: [] }), 1, { type: 'endTurn' });
  assert.deepEqual(none.hands[1], []);
  assert.equal(none.currentPlayer, 2);
});

test('fortify moves armies once through connected territories and ends the turn', () => {
  // Alice holds all of North America but Greenland
  const owners = ownership(2, Object.fromEntries(territoriesOf('northAmerica').filter(id => id !== 'greenland').map(id => [id, 1])));
  let state = attacking({ owners });
  assert.deepEqual([...connectedTerritories(state, 'alaska')].sort(),
    ['alberta', 'centralAmerica', 'easternUnitedStates', 'northwestTerritory', 'ontario', 'quebec', 'westernUnitedStates']);
  assert.deepEqual(move(state, 1, { type: 'fortify', from: 'alaska', to: 'venezuela', armies: 1 }), { error: 'Fortify between two territories you hold' });
  const island = attacking({ owners: { ...owners, iceland: 1 } });
  assert.deepEqual(move(island, 1, { type: 'fortify', from: 'alaska', to: 'iceland', armies: 1 }),
    { error: 'Iceland is not connected to Alaska through your territories' });
  assert.deepEqual(move(state, 1, { type: 'fortify', from: 'alaska', to: 'quebec', armies: 3 }), { error: 'Move 1 to 2 armies' });
  assert.deepEqual(move(state, 1, { type: 'fortify', from: 'alaska', to: 'quebec', armies: 0 }), { error: 'Move 1 to 2 armies' });
  state = played(state, 1, { type: 'endAttack' });
  assert.equal(state.phase, 'fortify');
  assert.deepEqual(move(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 1 }), { error: 'You can attack only in the attack phase' });
  state = played(state, 1, { type: 'fortify', from: 'alaska', to: 'quebec', armies: 2 });
  assert.equal(state.armies.alaska, 1);
  assert.equal(state.armies.quebec, 5);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.phase, 'reinforce');
});

test('eliminating a player takes their cards, and 6 or more must be traded down to 4 at once', () => {
  // Bob holds only Kamchatka and four cards; Alice has two
  const owners = ownership(1, { kamchatka: 2, greenland: 3 });
  let state = attacking({ owners, armies: { ...game().armies, alaska: 6, kamchatka: 1 }, hands: { 1: [0, 3], 2: [6, 9, 12, WILD_CARDS[0]], 3: [] } });
  state = played(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 3 }, dice(6, 6, 6, 1));
  assert.deepEqual(state.eliminated, [2]);
  assert.deepEqual(state.hands[2], []);
  assert.equal(state.hands[1].length, 6);
  state = played(state, 1, { type: 'occupy', armies: 3 });
  assert.equal(state.phase, 'reinforce');
  assert.equal(state.midTurnTrade, true);
  assert.deepEqual(move(state, 1, { type: 'endTurn' }), { error: 'You cannot end your turn yet' });
  state = played(state, 1, { type: 'trade', cards: [0, 3, 6] });
  assert.equal(state.reinforcements, 4);
  assert.equal(state.hands[1].length, 3);
  assert.deepEqual(move(state, 1, { type: 'trade', cards: [9, 12, WILD_CARDS[0]] }), { error: 'You hold fewer than 5 cards: place your armies' });
  state = played(state, 1, { type: 'place', placements: { kamchatka: 4 } });
  assert.equal(state.phase, 'attack');
  assert.equal(state.midTurnTrade, false);
  state = played(state, 1, { type: 'endTurn' });
  assert.equal(state.currentPlayer, 3); // Bob is skipped
  assert.deepEqual(move(state, 2, { type: 'endTurn' }), { error: 'You have been eliminated' });
});

test('taking cards that leave fewer than 6 waits for the next turn', () => {
  const owners = ownership(1, { kamchatka: 2, greenland: 3 });
  let state = attacking({ owners, armies: { ...game().armies, alaska: 6, kamchatka: 1 }, hands: { 1: [0], 2: [6, 9], 3: [] } });
  state = played(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 3 }, dice(6, 6, 6, 1));
  state = played(state, 1, { type: 'occupy', armies: 3 });
  assert.equal(state.phase, 'attack');
  assert.equal(state.hands[1].length, 3);
});

test('capturing the last territory wins the game', () => {
  let state = attacking({ owners: ownership(1, { kamchatka: 2 }), armies: { ...game().armies, alaska: 4, kamchatka: 1 } });
  state = played(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 2 }, dice(6, 6, 1));
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [1]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.armies.kamchatka, 2);
  assert.equal(state.armies.alaska, 2);
  assert.match(state.gameStatus, /Alice wins: they control the whole world/);
});

test('invalid moves are refused and change nothing', () => {
  const state = game({ hands: { 1: [0, 3], 2: [6], 3: [] } });
  const before = JSON.stringify(state);
  const bad: unknown[] = [
    null, 'place', 42, { type: 'fly' }, { type: 'place' }, { type: 'place', placements: [] },
    { type: 'place', placements: { atlantis: 1 } }, { type: 'place', placements: { alaska: '1' } },
    { type: 'place', placements: { alaska: -1 } }, { type: 'place', placements: { alaska: 1.5 } }, { type: 'place', placements: {} },
    { type: 'trade', cards: [0, 3, 6] }, { type: 'trade', cards: [0, 3, 99] }, { type: 'trade', cards: 'all' },
    { type: 'attack', from: 'alaska', to: 'kamchatka' }, { type: 'attack', from: 'alaska', to: 'mars', dice: 1 },
    { type: 'occupy', armies: 'all' }, { type: 'fortify', from: 'alaska', to: 'alberta', armies: -1 }, { type: 'endAttack' }
  ];
  for (const value of bad) assert.ok('error' in move(state, 1, value), JSON.stringify(value));
  const fighting = attacking();
  for (const dice of [0, -1, 1.5, 4]) assert.ok('error' in move(fighting, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice }));
  assert.equal(JSON.stringify(state), before);
});

test('a player dismissed mid-turn leaves neutral territories, their cards are discarded and the next turn begins', () => {
  let state = fourPlayers({ phase: 'attack', reinforcements: 0, owners: ownership(1, { kamchatka: 2, northwestTerritory: 2, greenland: 3, japan: 4 }),
    hands: { 1: [], 2: [7, 8], 3: [], 4: [] },
    armies: { ...game().armies, alaska: 5, kamchatka: 1 }, currentPlayer: 2, turnHolder: 2 });
  state = removePlayer(risk, state, 2, dice());
  assert.deepEqual(state.activePlayers, [1, 3, 4]);
  assert.equal(state.owners.kamchatka, null);
  assert.equal(state.armies.kamchatka, 1);
  assert.deepEqual(state.hands[2], []);
  assert.deepEqual(state.discard, [7, 8]);
  assert.equal(state.currentPlayer, 3);
  assert.equal(state.turnHolder, 3);
  assert.equal(state.phase, 'reinforce');
  assert.equal(state.reinforcements, 3);

  // A neutral territory defends with its armies and can be captured, and gives no cards
  state = { ...state, currentPlayer: 1, turnHolder: 1, phase: 'attack' };
  state = played(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 3 }, dice(6, 6, 6, 1));
  assert.equal(state.owners.kamchatka, 1);
  assert.equal(state.battle?.defender, null);
  assert.deepEqual(state.eliminated, []);
});

test('a player dismissed while moving into a capture leaves the minimum there', () => {
  let state = fourPlayers({ phase: 'attack', reinforcements: 0, armies: { ...game().armies, alaska: 5, kamchatka: 1 } });
  state = played(state, 1, { type: 'attack', from: 'alaska', to: 'kamchatka', dice: 3 }, dice(6, 1, 1, 2));
  state = removePlayer(risk, state, 1, dice());
  assert.equal(state.owners.kamchatka, null);
  assert.equal(state.armies.kamchatka, 3);
  assert.equal(state.armies.alaska, 2);
  assert.equal(state.conquest, null);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.phase, 'reinforce');
});

test('a player dismissed while not their turn changes nobody\'s turn', () => {
  const state = removePlayer(risk, fourPlayers({ phase: 'attack', reinforcements: 0 }), 3, dice());
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.phase, 'attack');
  assert.equal(state.owners.greenland, null);
});

test('a dismissal that leaves two of three players ends the game: the most territories wins', () => {
  // Alice holds 14 and Bob 14 plus Kamchatka
  const state = removePlayer(risk, game({ phase: 'attack', reinforcements: 0, owners: { ...game().owners, kamchatka: 2 } }), 3, dice());
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2]);
  assert.equal(state.currentPlayer, null);
  assert.match(state.gameStatus, /Too few players are left to go on. Bob wins with the most territories \(15\)/);
  const tied = removePlayer(risk, game({ phase: 'attack', reinforcements: 0 }), 3, dice());
  assert.deepEqual(tied.winners, [1, 2]);
});

test('a player dismissed during the setup is skipped, and the last one left holding territory wins', () => {
  let state = { ...lobby(4), started: true };
  state = removePlayer(risk, state, 1, dice());
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.phase, 'setup');
  state = played(state, 2, { type: 'place', placements: { [territoriesHeld(state, 2)[0]]: state.setupLeft[2] } });
  state = played(state, 3, { type: 'place', placements: { [territoriesHeld(state, 3)[0]]: state.setupLeft[3] } });
  state = played(state, 4, { type: 'place', placements: { [territoriesHeld(state, 4)[0]]: state.setupLeft[4] } });
  assert.equal(state.phase, 'reinforce');
  assert.equal(state.currentPlayer, 2); // the first player left, so the next one starts

  const lastTwo = attacking({ owners: ownership(1, { greenland: 3 }), eliminated: [2] });
  const won = removePlayer(risk, lastTwo, 3, dice());
  assert.equal(won.isGameOver, true);
  assert.deepEqual(won.winners, [1]);
});

test('table view hides hands: no hand, deck order or discard in any step of a short game', () => {
  let state = { ...lobby(3), started: true };
  const steps: GameState[] = [state];
  for (const seat of [1, 2, 3]) {
    state = played(state, seat, { type: 'place', placements: { [territoriesHeld(state, seat)[0]]: state.setupLeft[seat] } });
    steps.push(state);
  }
  // Alice places, attacks until she captures something, moves in and ends her turn, drawing a card
  state = played(state, 1, { type: 'place', placements: { [territoriesHeld(state, 1)[0]]: state.reinforcements } });
  steps.push(state);
  const enemyOf = (id: string) => NEIGHBORS[id].find(neighbor => state.owners[neighbor] !== 1);
  const from = territoriesHeld(state, 1).find(id => enemyOf(id) !== undefined)!;
  const target = enemyOf(from)!;
  const strong = { ...state, armies: { ...state.armies, [from]: 30, [target]: 1 } };
  state = played(strong, 1, { type: 'attack', from, to: target, dice: 3 }, dice(6, 6, 6, 1));
  steps.push(state);
  state = played(state, 1, { type: 'occupy', armies: 3 });
  steps.push(state);
  state = played(state, 1, { type: 'endTurn' }, dice(1));
  steps.push(state);
  assert.equal(state.hands[1].length, 1);
  const [card] = state.hands[1];

  for (const step of steps) {
    const view = toPublicState(step, false, null);
    assert.equal('hands' in view, false);
    assert.equal('deck' in view, false);
    assert.equal('discard' in view, false);
    assert.equal(view.hand, null);
    assert.equal(view.deckCount, step.deck.length);
    assert.deepEqual(view.handCounts, Object.fromEntries(Object.entries(step.hands).map(([seat, cards]) => [seat, cards.length])));
    assert.equal(/drew a card [^.]*\(/.test(JSON.stringify(view)), false);
  }
  assert.deepEqual(toPublicState(state, false, 1).hand, [card]);
  assert.deepEqual(toPublicState(state, false, 2).hand, []);
  assert.deepEqual(toPublicState(state, false, 2).handCounts, { 1: 1, 2: 0, 3: 0 });
});
