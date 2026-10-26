import { finalStandings } from './rules.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, ownable } from './board.ts';
import { housesLeft, hotelsLeft } from './buildings.ts';
import { jailCardIndex } from './cards.ts';
import { createGameState } from './rules.ts';
import { monopoly } from './index.ts';
import { addPlayer, disconnectPlayer, removePlayer } from '../../shared/seating.ts';
import { act, acted, dice, game, houseRules, move, played } from './testing.ts';
import type { GameState } from './types.ts';

const ALL_PROPERTIES = BOARD.flatMap((_, index) => ownable(index) ? [index] : []);
const ownedBy = (seat: number, spaces: number[]) => Object.fromEntries(spaces.map(space => [space, seat]));
const totalCash = (state: GameState) => Object.values(state.cash).reduce((sum, cash) => sum + cash, 0);

function lobby(...names: string[]): GameState {
  let state = createGameState('g');
  for (const name of names) {
    const result = addPlayer(monopoly, state, name, dice(6, 6, 1, 1, 2, 2));
    if ('error' in result) assert.fail(result.error);
    state = result.state;
  }
  return state;
}

test('each player starts with $1500 on GO, and the highest roll goes first', () => {
  const state = lobby('Alice', 'Bob', 'Cara');
  assert.deepEqual(state.cash, { 1: 1500, 2: 1500, 3: 1500 });
  assert.deepEqual(state.positions, { 1: 0, 2: 0, 3: 0 });
  assert.equal(state.decks.chance.length, 16);
  assert.equal(state.decks.chest.length, 16);
  assert.equal(state.turnHolder, 1); // rolled 12 against 2 and 4
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.canRoll, true);
});

test('passing Go pays $200', () => {
  const passed = played(game({ positions: { 1: 38, 2: 0, 3: 0 } }), 1, { type: 'roll' }, dice(2, 3));
  assert.equal(passed.positions[1], 3);
  assert.equal(passed.cash[1], 1700);
  assert.equal(passed.pendingBuy, 3);

  const landed = played(game({ positions: { 1: 35, 2: 0, 3: 0 } }), 1, { type: 'roll' }, dice(2, 3));
  assert.equal(landed.positions[1], 0);
  assert.equal(landed.cash[1], 1700);
});

test('three doubles in a turn sends you to jail', () => {
  let state = game({ positions: { 1: 10, 2: 0, 3: 0 }, owners: ownedBy(1, ALL_PROPERTIES) });
  state = played(state, 1, { type: 'roll' }, dice(2, 2));
  assert.equal(state.positions[1], 14);
  assert.equal(state.canRoll, true);
  assert.deepEqual(move(state, 1, { type: 'endTurn' }), { error: 'You rolled doubles: roll again' });
  state = played(state, 1, { type: 'roll' }, dice(3, 3));
  assert.equal(state.positions[1], 20);
  state = played(state, 1, { type: 'roll' }, dice(1, 1));
  assert.equal(state.positions[1], 10);
  assert.equal(state.jailed[1], 0);
  assert.equal(state.canRoll, false);
  state = played(state, 1, { type: 'endTurn' });
  assert.equal(state.currentPlayer, 2);
});

test('jail: pay $50, card, or doubles; pay on the third failed roll', () => {
  const jailed = game({ positions: { 1: 10, 2: 0, 3: 0 }, jailed: { 1: 0 }, owners: ownedBy(1, ALL_PROPERTIES) });

  const paid = played(jailed, 1, { type: 'payJailFine' });
  assert.equal(paid.cash[1], 1450);
  assert.equal(1 in paid.jailed, false);
  assert.equal(paid.canRoll, true);
  assert.equal(played(paid, 1, { type: 'roll' }, dice(2, 3)).positions[1], 15);

  const withCard = { ...jailed, jailCards: { 1: ['chance' as const] }, decks: { ...jailed.decks, chance: jailed.decks.chance.filter(i => i !== 8) } };
  const freed = played(withCard, 1, { type: 'useJailCard' });
  assert.equal(1 in freed.jailed, false);
  assert.deepEqual(freed.jailCards[1], []);
  assert.equal(freed.decks.chance.at(-1), jailCardIndex('chance'));
  assert.deepEqual(move(jailed, 1, { type: 'useJailCard' }), { error: 'You have no Get Out of Jail Free card' });

  const doubles = played(jailed, 1, { type: 'roll' }, dice(2, 2));
  assert.equal(1 in doubles.jailed, false);
  assert.equal(doubles.positions[1], 14);
  assert.equal(doubles.canRoll, false); // doubles out of jail do not roll again

  const failed = played(jailed, 1, { type: 'roll' }, dice(1, 2));
  assert.equal(failed.jailed[1], 1);
  assert.equal(failed.positions[1], 10);
  assert.equal(failed.canRoll, false);
  assert.deepEqual(move(failed, 1, { type: 'payJailFine' }), { error: 'Get out of Jail at the start of your turn, before rolling' });

  const third = played({ ...jailed, jailed: { 1: 2 } }, 1, { type: 'roll' }, dice(1, 2));
  assert.equal(1 in third.jailed, false);
  assert.equal(third.cash[1], 1450);
  assert.equal(third.positions[1], 13);
});

test('declining to buy starts an auction for every player and the high bid buys', () => {
  let state = played(game(), 1, { type: 'roll' }, dice(1, 2));
  assert.equal(state.pendingBuy, 3);
  state = played(state, 1, { type: 'decline' });
  assert.deepEqual(state.auction, { space: 3, highBid: 0, highBidder: null, passed: [] });
  assert.equal(state.pendingBuy, null);
  assert.deepEqual(move(state, 1, { type: 'endTurn' }), { error: 'Wait for the auction to finish' });

  state = acted(state, 2, { type: 'bid', amount: 10 });
  state = acted(state, 1, { type: 'bid', amount: 20 }); // the lander may bid too
  assert.deepEqual(act(state, 3, { type: 'bid', amount: 20 }), { error: 'Bid a whole number of dollars above $20' });
  assert.deepEqual(act(state, 3, { type: 'bid', amount: 2000 }), { error: 'You cannot bid more cash than you have' });
  state = acted(state, 3, { type: 'passBid' });
  assert.deepEqual(act(state, 3, { type: 'bid', amount: 50 }), { error: 'You have passed in this auction' });
  assert.deepEqual(act(state, 1, { type: 'passBid' }), { error: 'You hold the high bid' });
  state = acted(state, 2, { type: 'bid', amount: 30 });
  state = acted(state, 1, { type: 'passBid' });
  assert.equal(state.auction, null);
  assert.equal(state.owners[3], 2);
  assert.equal(state.cash[2], 1470);
  state = played(state, 1, { type: 'endTurn' });
  assert.equal(state.currentPlayer, 2);
});

test('an auction does not wait on a disconnected player', () => {
  let state = played(played(game(), 1, { type: 'roll' }, dice(1, 2)), 1, { type: 'decline' });
  state = acted(state, 2, { type: 'bid', amount: 10 });
  state = acted(state, 1, { type: 'passBid' });
  assert.notEqual(state.auction, null); // Cara has not passed yet
  state = disconnectPlayer(monopoly, state, 3);
  assert.equal(state.auction, null);
  assert.equal(state.owners[3], 2);
});

test('an auction nobody bids in leaves the property with the bank', () => {
  let state = played(played(game(), 1, { type: 'roll' }, dice(1, 2)), 1, { type: 'decline' });
  for (const seat of [1, 2, 3]) state = acted(state, seat, { type: 'passBid' });
  assert.equal(state.auction, null);
  assert.equal(state.owners[3], undefined);
});

test('a monopoly doubles unimproved rent', () => {
  const roll = (overrides: Partial<GameState>) => played(game(overrides), 1, { type: 'roll' }, dice(1, 2));
  assert.equal(roll({ owners: { 3: 2 } }).cash[1], 1496);
  const whole = roll({ owners: { 1: 2, 3: 2 } });
  assert.equal(whole.cash[1], 1492);
  assert.equal(whole.cash[2], 1508);
  assert.equal(roll({ owners: { 1: 2, 3: 2 }, mortgaged: [1] }).cash[1], 1492);
  assert.equal(roll({ owners: { 1: 2, 3: 2 }, mortgaged: [3] }).cash[1], 1500); // mortgaged: no rent
  assert.equal(roll({ owners: { 1: 2, 3: 2 }, buildings: { 1: 1, 3: 2 } }).cash[1], 1440);
});

test('railroads and utilities charge by how many the owner has', () => {
  const railroads = played(game({ owners: { 5: 2, 15: 2, 25: 2 } }), 1, { type: 'roll' }, dice(2, 3));
  assert.equal(railroads.cash[1], 1400);
  const utility = played(game({ positions: { 1: 5, 2: 0, 3: 0 }, owners: { 12: 2 } }), 1, { type: 'roll' }, dice(3, 4));
  assert.equal(utility.cash[1], 1500 - 28);
  const both = played(game({ positions: { 1: 5, 2: 0, 3: 0 }, owners: { 12: 2, 28: 2 } }), 1, { type: 'roll' }, dice(3, 4));
  assert.equal(both.cash[1], 1500 - 70);
});

test('building must be even and stops at 32 houses and 12 hotels', () => {
  const brown = { owners: ownedBy(1, [1, 3]) };
  let state = played(game(brown), 1, { type: 'build', space: 1 });
  assert.equal(state.buildings[1], 1);
  assert.equal(state.cash[1], 1450);
  assert.deepEqual(move(state, 1, { type: 'build', space: 1 }), { error: 'Build evenly: the other streets of the group need a house first' });
  state = played(state, 1, { type: 'build', space: 3 });
  state = played(state, 1, { type: 'build', space: 1 });
  assert.deepEqual(move(state, 1, { type: 'sellBuilding', space: 3 }), { error: 'Sell evenly: sell from the streets of the group with the most buildings first' });
  assert.equal(played(state, 1, { type: 'sellBuilding', space: 1 }).cash[1], 1500 - 150 + 25);
  assert.deepEqual(move(game({ owners: { 1: 1 } }), 1, { type: 'build', space: 1 }), { error: 'You need every street of the color group to build' });
  assert.deepEqual(move(game({ ...brown, mortgaged: [3] }), 1, { type: 'build', space: 1 }), { error: 'Lift every mortgage in the group before building' });
  assert.deepEqual(move(state, 1, { type: 'mortgage', space: 3 }), { error: 'Sell every building in the color group first' });

  // 31 houses already stand elsewhere: one more, then none
  const elsewhere = { 6: 4, 8: 4, 9: 4, 11: 4, 13: 4, 14: 4, 16: 4, 18: 3 };
  let short = played(game({ ...brown, buildings: elsewhere }), 1, { type: 'build', space: 1 });
  assert.equal(housesLeft(short), 0);
  assert.deepEqual(move(short, 1, { type: 'build', space: 3 }), { error: 'The bank has no houses left' });

  // A hotel gives back its four houses; twelve hotels elsewhere leave none
  const fourEach = game({ ...brown, buildings: { 1: 4, 3: 4 } });
  const hotel = played(fourEach, 1, { type: 'build', space: 1 });
  assert.equal(hotel.buildings[1], 5);
  assert.equal(housesLeft(hotel), housesLeft(fourEach) + 4);
  const hotels = Object.fromEntries([6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24].map(space => [space, 5]));
  short = game({ ...brown, buildings: { ...hotels, 1: 4, 3: 4 } });
  assert.equal(hotelsLeft(short), 0);
  assert.deepEqual(move(short, 1, { type: 'build', space: 1 }), { error: 'The bank has no hotels left' });
});

test('a hotel sells back as four houses, or outright when the bank has fewer', () => {
  const state = game({ owners: ownedBy(1, [1, 3]), buildings: { 1: 5, 3: 5 } });
  const broken = played(state, 1, { type: 'sellBuilding', space: 1 });
  assert.equal(broken.buildings[1], 4);
  assert.equal(broken.cash[1], 1525);
  const elsewhere = { 6: 4, 8: 4, 9: 4, 11: 4, 13: 4, 14: 4, 16: 4, 18: 2 };
  const outright = played({ ...state, buildings: { ...state.buildings, ...elsewhere } }, 1, { type: 'sellBuilding', space: 1 });
  assert.equal(outright.buildings[1], undefined);
  assert.equal(outright.cash[1], 1625);
});

test('unmortgaging costs the mortgage plus 10%', () => {
  let state = played(game({ owners: { 37: 1 } }), 1, { type: 'mortgage', space: 37 });
  assert.deepEqual(state.mortgaged, [37]);
  assert.equal(state.cash[1], 1675);
  state = played(state, 1, { type: 'unmortgage', space: 37 });
  assert.deepEqual(state.mortgaged, []);
  assert.equal(state.cash[1], 1675 - 193);
  assert.deepEqual(move(game({ owners: { 37: 1 }, mortgaged: [37], cash: { 1: 100, 2: 0, 3: 0 } }), 1, { type: 'unmortgage', space: 37 }),
    { error: 'You need $193 to lift the mortgage' });
});

test('a trade moves property, cash and jail cards only when both agree', () => {
  const start = game({ owners: { 1: 1, 5: 2 }, mortgaged: [5], jailCards: { 1: ['chance'], 2: [], 3: [] } });
  const offer = {
    type: 'offerTrade', to: 2,
    give: { properties: [1], cash: 100, jailCards: 1 },
    get: { properties: [5], cash: 0, jailCards: 0 }
  };
  const offered = acted(start, 1, offer);
  assert.equal(offered.owners[1], 1);
  assert.equal(offered.cash[1], 1500);
  assert.deepEqual(act(offered, 3, { type: 'answerTrade', accept: true }), { error: 'There is no offer for you to answer' });
  assert.deepEqual(act(offered, 3, { ...offer, to: 1 }), { error: 'Another trade is waiting for an answer' });

  const declined = acted(offered, 2, { type: 'answerTrade', accept: false });
  assert.deepEqual(declined.owners, start.owners);
  assert.equal(declined.trade, null);

  const accepted = acted(offered, 2, { type: 'answerTrade', accept: true });
  assert.equal(accepted.owners[1], 2);
  assert.equal(accepted.owners[5], 1);
  assert.equal(accepted.cash[2], 1600);
  assert.equal(accepted.cash[1], 1400);
  assert.deepEqual(accepted.jailCards, { 1: [], 2: ['chance'], 3: [] });
  // Alice received a mortgaged railroad, so she decides about its mortgage before play goes on
  assert.deepEqual(accepted.mortgageDecisions, [{ seat: 1, spaces: [5] }]);
  assert.equal(accepted.currentPlayer, 1);
  assert.deepEqual(move(accepted, 1, { type: 'roll' }), { error: 'Lift or keep the mortgages you received first' });
  const kept = played(accepted, 1, { type: 'liftMortgages', spaces: [] });
  assert.equal(kept.cash[1], 1390); // 10% interest
  assert.deepEqual(kept.mortgaged, [5]);
  assert.deepEqual(kept.mortgageDecisions, []);

  const withdrawn = acted(offered, 1, { type: 'cancelTrade' });
  assert.equal(withdrawn.trade, null);
  const built = game({ owners: ownedBy(1, [1, 3]), buildings: { 3: 1 } });
  assert.deepEqual(act(built, 1, { ...offer, give: { properties: [1], cash: 0, jailCards: 0 } }),
    { error: "Sell the buildings in Mediterranean Avenue's color group before trading it" });
});

test('whoever receives a mortgaged property lifts it at once for 110%, or pays 10% and keeps it', () => {
  const start = game({ owners: { 5: 2, 6: 2 }, mortgaged: [5, 6] });
  const offer = { type: 'offerTrade', to: 3, give: { properties: [5, 6], cash: 0, jailCards: 0 }, get: { properties: [], cash: 10, jailCards: 0 } };
  let state = acted(acted(start, 2, offer), 3, { type: 'answerTrade', accept: true });
  assert.deepEqual(state.mortgageDecisions, [{ seat: 3, spaces: [5, 6] }]);
  assert.equal(state.currentPlayer, 3);
  assert.deepEqual(act(state, 1, offer), { error: 'Wait for Cara to decide about the mortgages' });
  assert.deepEqual(move(state, 3, { type: 'liftMortgages', spaces: [9] }), { error: 'You did not just receive that property' });
  assert.equal('error' in move(state, 3, { type: 'liftMortgages', spaces: 'all' }), true);
  state = played(state, 3, { type: 'liftMortgages', spaces: [5] });
  assert.equal(state.cash[3], 1490 - 110 - 5); // Reading lifted for $110, Oriental kept for $5
  assert.deepEqual(state.mortgaged, [6]);
  assert.equal(state.currentPlayer, 1);
});

test('a trade is refused when a receiver cannot pay the interest on a mortgaged property', () => {
  const start = game({ owners: { 5: 2 }, mortgaged: [5], cash: { 1: 1500, 2: 1500, 3: 10 } });
  const offer = { type: 'offerTrade', to: 3, give: { properties: [5], cash: 0, jailCards: 0 }, get: { properties: [], cash: 0, jailCards: 0 } };
  const broke = { ...start, cash: { ...start.cash, 3: 0 } };
  const refused = { error: 'Cara could not pay the 10% interest on the mortgaged property' };
  assert.deepEqual(act(broke, 2, offer), refused);
  const offered = acted(start, 2, offer);
  assert.deepEqual(act({ ...offered, cash: broke.cash }, 3, { type: 'answerTrade', accept: true }), refused);
  assert.equal(acted(offered, 3, { type: 'answerTrade', accept: true }).owners[5], 3);
});

test('a debt waits for the debtor, who may mortgage to pay it', () => {
  // Community Chest on top: "It is your birthday", and Cara has only $5
  const start = game({
    owners: { 39: 3 },
    cash: { 1: 1500, 2: 1500, 3: 5 },
    decks: { chance: [], chest: [8, ...Array.from({ length: 15 }, (_, i) => i === 8 ? 15 : i)] }
  });
  let state = played(start, 1, { type: 'roll' }, dice(1, 1));
  assert.equal(state.cash[1], 1510);
  assert.equal(state.currentPlayer, 3);
  assert.deepEqual(state.debts, [{ debtor: 3, creditor: 1, amount: 10, reason: 'Community Chest' }]);
  assert.deepEqual(move(state, 3, { type: 'roll' }), { error: 'Pay what you owe first: sell buildings, mortgage, trade, or declare bankruptcy' });
  state = played(state, 3, { type: 'mortgage', space: 39 });
  assert.deepEqual(state.debts, []);
  assert.equal(state.cash[3], 195);
  assert.equal(state.cash[1], 1520);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.canRoll, true); // the doubles still roll again
});

test('cards move, pay and collect', () => {
  const chanceFirst = (index: number, overrides: Partial<GameState> = {}) => {
    const rest = Array.from({ length: 16 }, (_, i) => i).filter(i => i !== index);
    return game({ positions: { 1: 4, 2: 0, 3: 0 }, decks: { chance: [index, ...rest], chest: [] }, ...overrides });
  };
  const boardwalk = played(chanceFirst(0), 1, { type: 'roll' }, dice(1, 2));
  assert.equal(boardwalk.positions[1], 39);
  assert.equal(boardwalk.pendingBuy, 39);
  assert.equal(boardwalk.decks.chance.at(-1), 0);
  assert.deepEqual(boardwalk.drawnCard, { deck: 'chance', index: 0, seat: 1 });

  const railroad = played(chanceFirst(4, { owners: { 15: 2 } }), 1, { type: 'roll' }, dice(1, 2));
  assert.equal(railroad.positions[1], 15);
  assert.equal(railroad.cash[1], 1450);

  const utility = played(chanceFirst(6, { owners: { 12: 2 } }), 1, { type: 'roll' }, dice(1, 2, 3, 4));
  assert.equal(utility.positions[1], 12);
  assert.equal(utility.cash[1], 1430);

  const back = played(chanceFirst(9), 1, { type: 'roll' }, dice(1, 2));
  assert.equal(back.positions[1], 4);
  assert.equal(back.cash[1], 1300); // Income Tax

  const kept = played(chanceFirst(8), 1, { type: 'roll' }, dice(1, 2));
  assert.deepEqual(kept.jailCards[1], ['chance']);
  assert.equal(kept.decks.chance.length, 15);

  const chairman = played(chanceFirst(14), 1, { type: 'roll' }, dice(1, 2));
  assert.deepEqual(chairman.cash, { 1: 1400, 2: 1550, 3: 1550 });

  const repairs = played(chanceFirst(11, { owners: ownedBy(1, [1, 3]), buildings: { 1: 5, 3: 4 } }), 1, { type: 'roll' }, dice(1, 2));
  assert.equal(repairs.cash[1], 1500 - 100 - 4 * 25);
});

test('a Go to Jail card or space pays nothing for passing GO', () => {
  const card = played(game({ positions: { 1: 33, 2: 0, 3: 0 }, decks: { chance: [10], chest: [] } }), 1, { type: 'roll' }, dice(1, 2));
  assert.equal(card.positions[1], 10);
  assert.equal(card.jailed[1], 0);
  assert.equal(card.cash[1], 1500);
  const space = played(game({ positions: { 1: 25, 2: 0, 3: 0 } }), 1, { type: 'roll' }, dice(2, 3));
  assert.equal(space.positions[1], 10);
  assert.equal(space.jailed[1], 0);
});

test('no Free Parking money', () => {
  let state = played(game(), 1, { type: 'roll' }, dice(1, 3)); // Income Tax
  assert.equal(totalCash(state), 4500 - 200);
  state = played(state, 1, { type: 'endTurn' });
  state = played({ ...state, positions: { ...state.positions, 2: 17 } }, 2, { type: 'roll' }, dice(1, 2));
  assert.equal(state.positions[2], 20);
  assert.equal(state.cash[2], 1500);
  assert.equal(totalCash(state), 4500 - 200);
});

test('buying needs the cash, and the turn ends only after rolling', () => {
  const landed = played(game({ cash: { 1: 50, 2: 1500, 3: 1500 } }), 1, { type: 'roll' }, dice(2, 4));
  assert.equal(landed.pendingBuy, 6);
  assert.deepEqual(move(landed, 1, { type: 'buy' }),
    { error: 'You need $100: sell buildings or mortgage first, or decline to auction it' });
  assert.deepEqual(move(landed, 1, { type: 'endTurn' }), { error: 'Buy the property or decline it first' });
  const bought = played(played(game(), 1, { type: 'roll' }, dice(2, 4)), 1, { type: 'buy' });
  assert.equal(bought.owners[6], 1);
  assert.equal(bought.cash[1], 1400);
  assert.deepEqual(move(game(), 1, { type: 'endTurn' }), { error: 'Roll the dice first' });
});

test('bankrupt to a player hands over everything; to the bank, properties are auctioned', () => {
  const broke = game({
    positions: { 1: 35, 2: 0, 3: 0 },
    cash: { 1: 10, 2: 1500, 3: 1500 },
    owners: { ...ownedBy(1, [1, 3, 5]), ...ownedBy(2, [37, 39]) },
    buildings: { 1: 1, 3: 1, 37: 5, 39: 5 },
    mortgaged: [5],
    jailCards: { 1: ['chest'], 2: [], 3: [] }
  });
  let state = played(broke, 1, { type: 'roll' }, dice(1, 3));
  assert.deepEqual(state.debts, [{ debtor: 1, creditor: 2, amount: 2000, reason: 'rent for Boardwalk' }]);
  state = played(state, 1, { type: 'declareBankruptcy' });
  assert.deepEqual(state.bankrupt, [1]);
  assert.equal(state.cash[1], 0);
  assert.equal(state.cash[2], 1500 + 10 + 50); // cash and the houses sold at half price
  assert.deepEqual(state.mortgageDecisions, [{ seat: 2, spaces: [5] }]);
  state = played(state, 2, { type: 'liftMortgages', spaces: [] });
  assert.equal(state.cash[2], 1500 + 10 + 50 - 10); // less 10% interest to keep the railroad mortgaged
  assert.deepEqual([1, 3, 5].map(space => state.owners[space]), [2, 2, 2]);
  assert.equal(state.buildings[1], undefined);
  assert.deepEqual(state.mortgaged, [5]);
  assert.deepEqual(state.jailCards[2], ['chest']);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.debts, []);

  const taxed = game({ cash: { 1: 100, 2: 1500, 3: 1500 }, owners: ownedBy(1, [1, 3]), mortgaged: [1], jailCards: { 1: ['chance'], 2: [], 3: [] }, decks: { chance: [], chest: [] } });
  state = played(played(taxed, 1, { type: 'roll' }, dice(1, 3)), 1, { type: 'declareBankruptcy' });
  assert.deepEqual(state.owners, {});
  assert.deepEqual(state.mortgaged, []);
  assert.deepEqual(state.decks.chance, [jailCardIndex('chance')]);
  assert.equal(state.auction?.space, 1);
  assert.deepEqual(state.auctionQueue, [3]);
  assert.equal(state.turnHolder, 2);
  assert.deepEqual(act(state, 1, { type: 'bid', amount: 5 }), { error: 'You are out of the game' });
  state = acted(acted(state, 2, { type: 'bid', amount: 5 }), 3, { type: 'passBid' });
  assert.equal(state.owners[1], 2);
  assert.equal(state.auction?.space, 3);
  assert.deepEqual(move(state, 2, { type: 'roll' }), { error: 'Wait for the auction to finish' });
});

test('last player left wins', () => {
  const two = game({ activePlayers: [1, 2], playerNames: { 1: 'Alice', 2: 'Bob' }, cash: { 1: 1500, 2: 1500 }, owners: { 1: 1 } });
  const state = played(two, 1, { type: 'declareBankruptcy' });
  assert.equal(state.isGameOver, true);
  assert.deepEqual(state.winners, [2]);
  assert.equal(state.currentPlayer, null);
  assert.equal(state.auction, null);
  assert.equal(state.gameStatus.endsWith('Bob wins: everyone else is bankrupt'), true);
  assert.deepEqual(act(state, 2, { type: 'passBid' }), { error: 'The game is over' });
});

test('invalid moves', () => {
  const state = game({ owners: { 1: 1 }, trade: null });
  const errors = [
    move(state, 1, null),
    move(state, 1, { type: 'fly' }),
    move(state, 1, { type: 'build', space: 40 }),
    move(state, 1, { type: 'build', space: -1 }),
    move(state, 1, { type: 'mortgage', space: 1.5 }),
    move(state, 1, { type: 'mortgage', space: '1' }),
    act(state, 1, null),
    act(state, 1, { type: 'bid', amount: 10 }),
    act(state, 1, { type: 'offerTrade', to: 9, give: { properties: [1], cash: 0, jailCards: 0 }, get: { properties: [], cash: 0, jailCards: 0 } }),
    act(state, 1, { type: 'offerTrade', to: 2, give: { properties: [3], cash: 0, jailCards: 0 }, get: { properties: [], cash: 0, jailCards: 0 } }),
    act(state, 1, { type: 'offerTrade', to: 2, give: { properties: [1], cash: -5, jailCards: 0 }, get: { properties: [], cash: 0, jailCards: 0 } }),
    act(state, 1, { type: 'offerTrade', to: 2, give: { properties: [1, 1], cash: 0, jailCards: 0 }, get: { properties: [], cash: 0, jailCards: 0 } }),
    act(state, 1, { type: 'offerTrade', to: 2, give: { properties: [1], cash: 0, jailCards: 1 }, get: { properties: [], cash: 0, jailCards: 0 } }),
    act(state, 1, { type: 'offerTrade', to: 2, give: 'everything', get: {} }),
    act(state, 1, { type: 'answerTrade', accept: 'yes' }),
    act(state, 1, { type: 'cancelTrade' })
  ];
  for (const result of errors) assert.equal('error' in result, true, JSON.stringify(result));

  const auction = game({ auction: { space: 3, highBid: 10, highBidder: 2, passed: [] } });
  for (const amount of [-5, 0, 10.5, '20', 1e9]) assert.equal('error' in act(auction, 1, { type: 'bid', amount }), true);
  assert.deepEqual(move(game({ bankrupt: [1] }), 1, { type: 'roll' }), { error: 'You are bankrupt' });
});

test('dismissed player mid-turn', () => {
  // Bob is deciding whether to buy, owns two properties and holds the high bid nowhere
  let state = game({ currentPlayer: 2, turnHolder: 2, canRoll: false, pendingBuy: 6, positions: { 1: 0, 2: 6, 3: 0 }, owners: ownedBy(2, [1, 3]) });
  state = removePlayer(monopoly, state, 2);
  assert.deepEqual(state.activePlayers, [1, 3]);
  assert.equal(state.pendingBuy, null);
  assert.equal(state.turnHolder, 3);
  assert.equal(state.currentPlayer, 3);
  assert.equal(state.auction?.space, 1);
  assert.deepEqual(state.auctionQueue, [3]);

  // Cara owes Alice and holds the high bid when she is dismissed
  const owing = game({
    debts: [{ debtor: 3, creditor: 1, amount: 10, reason: 'Community Chest' }],
    currentPlayer: 3,
    auction: { space: 9, highBid: 40, highBidder: 3, passed: [2] },
    trade: { from: 2, to: 3, give: { properties: [], cash: 5, jailCards: 0 }, get: { properties: [], cash: 0, jailCards: 0 } }
  });
  const gone = removePlayer(monopoly, owing, 3);
  assert.deepEqual(gone.debts, []);
  assert.equal(gone.trade, null);
  assert.deepEqual(gone.auction, { space: 9, highBid: 0, highBidder: null, passed: [] });
  assert.equal(gone.currentPlayer, 1);
});

test('a dismissed debtor goes bankrupt to the player they owe', () => {
  const owing = game({
    owners: { 39: 3 },
    debts: [{ debtor: 3, creditor: 1, amount: 500, reason: 'rent for Boardwalk' }],
    cash: { 1: 1500, 2: 1500, 3: 20 },
    currentPlayer: 3
  });
  const gone = removePlayer(monopoly, owing, 3);
  assert.equal(gone.owners[39], 1);
  assert.equal(gone.cash[1], 1520);
  assert.equal(gone.auction, null);
});

test('an open trade from or to a player who disconnects is dropped', () => {
  const offered = acted(game({ owners: { 1: 1 } }), 1, { type: 'offerTrade', to: 3, give: { properties: [1], cash: 0, jailCards: 0 }, get: { properties: [], cash: 50, jailCards: 0 } });
  assert.equal(disconnectPlayer(monopoly, offered, 3).trade, null);
  assert.notEqual(disconnectPlayer(monopoly, offered, 2).trade, null);
});

test('table view hides only the deck order', () => {
  const state = game();
  for (const viewer of [null, 1, 2]) {
    const view = monopoly.toPublicState(state, false, viewer);
    assert.equal('decks' in view, false);
    assert.deepEqual(view.deckCounts, { chance: 16, chest: 16 });
    assert.deepEqual(view.cash, state.cash);
  }
});

const JACKPOT = { houseRules: houseRules({ freeParkingJackpot: true }) };
const NO_AUCTIONS = { houseRules: houseRules({ auctions: false }) };

test('taxes, card fees and the jail fine go into the pot with the jackpot on', () => {
  let state = played(game({ ...JACKPOT, positions: { 1: 2, 2: 0, 3: 0 } }), 1, { type: 'roll' }, dice(1, 1)); // Income Tax
  assert.equal(state.positions[1], 4);
  assert.equal(state.cash[1], 1300);
  assert.equal(state.freeParkingPot, 200);

  // Community Chest "Doctor's fee. Pay $50" is the third card
  const chest = game({ ...JACKPOT, positions: { 1: 0, 2: 0, 3: 0 }, decks: { chance: game().decks.chance, chest: [2, ...game().decks.chest.filter(i => i !== 2)] } });
  state = played(chest, 1, { type: 'roll' }, dice(1, 1)); // lands on Community Chest at 2
  assert.equal(state.cash[1], 1450);
  assert.equal(state.freeParkingPot, 50);

  const jailed = played(game({ ...JACKPOT, positions: { 1: 10, 2: 0, 3: 0 }, jailed: { 1: 0 } }), 1, { type: 'payJailFine' });
  assert.equal(jailed.freeParkingPot, 50);
  assert.equal(totalCash(jailed) + jailed.freeParkingPot, 4500);

  const poor = played(game({ ...JACKPOT, positions: { 1: 2, 2: 0, 3: 0 }, cash: { 1: 100, 2: 1500, 3: 1500 } }), 1, { type: 'roll' }, dice(1, 1));
  assert.deepEqual(poor.debts, [{ debtor: 1, creditor: null, amount: 200, reason: 'Income Tax', toPot: true }]);
  assert.ok(poor.log.includes('Alice owes Free Parking $200 (Income Tax)'), poor.log.join(' | '));
  const mortgaged = game({ ...JACKPOT, cash: { 1: 180, 2: 1500, 3: 1500 }, owners: { 1: 1 }, debts: poor.debts });
  const raised = played({ ...mortgaged, currentPlayer: 1 }, 1, { type: 'mortgage', space: 1 });
  assert.equal(raised.freeParkingPot, 200);
  assert.ok(raised.log.includes('Alice paid Free Parking $200 (Income Tax)'), raised.log.join(' | '));
});

test('landing on Free Parking collects the pot', () => {
  const state = played(game({ ...JACKPOT, freeParkingPot: 340, positions: { 1: 18, 2: 0, 3: 0 } }), 1, { type: 'roll' }, dice(1, 1));
  assert.equal(state.positions[1], 20);
  assert.equal(state.cash[1], 1840);
  assert.equal(state.freeParkingPot, 0);
});

test('with the jackpot off Free Parking pays nothing and taxes go to the bank', () => {
  const taxed = played(game({ positions: { 1: 2, 2: 0, 3: 0 } }), 1, { type: 'roll' }, dice(1, 1));
  assert.equal(taxed.cash[1], 1300);
  assert.equal(taxed.freeParkingPot ?? 0, 0);
  const parked = played(game({ positions: { 1: 18, 2: 0, 3: 0 } }), 1, { type: 'roll' }, dice(1, 1));
  assert.equal(parked.cash[1], 1500);
});

test('landing exactly on GO pays $400 with the rule on and $200 off', () => {
  const on = { houseRules: houseRules({ goBonus: true }) };
  const roll = (fields: Partial<GameState>) => played(game({ positions: { 1: 35, 2: 0, 3: 0 }, ...fields }), 1, { type: 'roll' }, dice(2, 3));
  assert.equal(roll(on).cash[1], 1900);
  assert.equal(roll({}).cash[1], 1700);
  // Chance "Advance to GO" is the second card
  const card = (fields: Partial<GameState>) => {
    const base = game({ positions: { 1: 4, 2: 0, 3: 0 }, ...fields });
    return played({ ...base, decks: { ...base.decks, chance: [1, ...base.decks.chance.filter(i => i !== 1)] } }, 1, { type: 'roll' }, dice(1, 2));
  };
  assert.equal(card(on).cash[1], 1900);
  assert.equal(card({}).cash[1], 1700);
});

test('passing GO still pays $200 with the rule on', () => {
  const state = played(game({ houseRules: houseRules({ goBonus: true }), positions: { 1: 38, 2: 0, 3: 0 } }), 1, { type: 'roll' }, dice(2, 3));
  assert.equal(state.positions[1], 3);
  assert.equal(state.cash[1], 1700);
});

test('with auctions off the buy error offers a plain decline', () => {
  const landed = played(game({ ...NO_AUCTIONS, cash: { 1: 50, 2: 1500, 3: 1500 } }), 1, { type: 'roll' }, dice(2, 4));
  assert.deepEqual(move(landed, 1, { type: 'buy' }), { error: 'You need $100: sell buildings or mortgage first, or decline it' });
});

test('with auctions off a declined property stays with the bank', () => {
  let state = played(game(NO_AUCTIONS), 1, { type: 'roll' }, dice(1, 2));
  state = played(state, 1, { type: 'decline' });
  assert.equal(state.auction, null);
  assert.equal(state.pendingBuy, null);
  assert.equal(state.owners[3], undefined);
  state = played(state, 1, { type: 'endTurn' });
  assert.equal(state.currentPlayer, 2);
});

test('with auctions off a bankrupt player\'s properties return to the bank unowned', () => {
  const broke = game({
    ...NO_AUCTIONS,
    positions: { 1: 35, 2: 0, 3: 0 },
    cash: { 1: 10, 2: 1500, 3: 1500 },
    owners: { ...ownedBy(1, [1, 3, 5]), ...ownedBy(2, [37, 39]) },
    mortgaged: [5]
  });
  let state = played(broke, 1, { type: 'roll' }, dice(1, 3)); // Boardwalk rent
  state = played(state, 1, { type: 'declareBankruptcy' }); // owes player 2, who takes them
  assert.deepEqual([1, 3, 5].map(space => state.owners[space]), [2, 2, 2]);

  const toBank = played(game({ ...NO_AUCTIONS, owners: ownedBy(1, [1, 3]), positions: { 1: 0, 2: 0, 3: 0 } }), 1, { type: 'declareBankruptcy' });
  assert.deepEqual([1, 3].map(space => toBank.owners[space]), [undefined, undefined]);
  assert.equal(toBank.auction, null);
  assert.deepEqual(toBank.auctionQueue, []);
});

test('finalStandings ranks the bankrupt players by when they went bankrupt', () => {
  const state: GameState = { ...createGameState('t'), activePlayers: [1, 2, 3, 4], isGameOver: true, winners: [1], bankrupt: [4, 3] };
  assert.deepEqual(finalStandings(state), [
    { seat: 1, place: 1 }, { seat: 2, place: 2 }, { seat: 3, place: 3, score: 'Bankrupt' }, { seat: 4, place: 4, score: 'Bankrupt' }
  ]);
});
