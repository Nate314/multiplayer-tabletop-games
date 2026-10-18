// Rolling, moving round the board, landing, rent, cards and jail
import {
  BOARD, BOARD_SIZE, GO_SALARY, HOTEL, JAIL, JAIL_FINE, RAILROAD_RENTS, UTILITY_MULTIPLIERS, groupSpaces, ownable,
  spacesOfKind
} from './board.ts';
import { DECKS, DECK_NAMES, jailCardIndex } from './cards.ts';
import { charge, giveCash } from './money.ts';
import { inGame, money, nameOf, note } from './state.ts';
import type { DeckName, GameState, Random, Seat } from './types.ts';

export const MAX_DOUBLES = 3;
export const MAX_JAIL_ROLLS = 3;

// How a card's move changes the rent where it lands
type Landing = 'normal' | 'doubleRailroad' | 'utilityTimesTen';

export function rollDie(random: Random): number {
  return Math.min(6, 1 + Math.floor(random() * 6));
}

export function rollDice(random: Random): [number, number] {
  return [rollDie(random), rollDie(random)];
}

const total = (dice: [number, number] | null) => dice ? dice[0] + dice[1] : 0;

export function ownsGroup(state: GameState, seat: Seat, space: number): boolean {
  const target = BOARD[space];
  if (target.kind !== 'street') return false;
  return groupSpaces(target.group).every(index => state.owners[index] === seat);
}

function ownedOfKind(state: GameState, seat: Seat, kind: 'railroad' | 'utility'): number {
  return spacesOfKind(kind).filter(index => state.owners[index] === seat).length;
}

// What landing on `space` costs, with the dice that got there for a utility. Mortgaged and bank-owned spaces cost nothing.
// A whole color group doubles the rent of its unimproved streets, even when another street of the group is mortgaged.
export function rentFor(state: GameState, space: number, diceTotal: number): number {
  const owner = state.owners[space];
  const target = BOARD[space];
  if (owner === undefined || state.mortgaged.includes(space)) return 0;
  if (target.kind === 'street') {
    const level = state.buildings[space] ?? 0;
    if (level > 0) return target.rents[level];
    return target.rents[0] * (ownsGroup(state, owner, space) ? 2 : 1);
  }
  if (target.kind === 'railroad') return RAILROAD_RENTS[ownedOfKind(state, owner, 'railroad') - 1];
  if (target.kind === 'utility') return UTILITY_MULTIPLIERS[ownedOfKind(state, owner, 'utility') - 1] * diceTotal;
  return 0;
}

export function sendToJail(state: GameState, seat: Seat): GameState {
  return note({
    ...state,
    positions: { ...state.positions, [seat]: JAIL },
    jailed: { ...state.jailed, [seat]: 0 },
    canRoll: false,
    doublesRolled: 0
  }, `${nameOf(state, seat)} went to Jail`);
}

// Used or forfeited Get Out of Jail Free cards go to the bottom of the decks they came from
export function returnJailCards(decks: GameState['decks'], held: DeckName[]): GameState['decks'] {
  const next = { ...decks };
  for (const deck of held) next[deck] = [...next[deck], jailCardIndex(deck)];
  return next;
}

export function leaveJail(state: GameState, seat: Seat): GameState {
  const { [seat]: _rolls, ...jailed } = state.jailed;
  return { ...state, jailed };
}

// Moves forward to `to`, collecting $200 for passing or landing on GO
function moveTo(state: GameState, seat: Seat, to: number): GameState {
  const from = state.positions[seat];
  const moved = note({ ...state, positions: { ...state.positions, [seat]: to } }, `${nameOf(state, seat)} moved to ${BOARD[to].name}`);
  if (to > from) return moved;
  return note(giveCash(moved, seat, GO_SALARY), `${nameOf(state, seat)} passed GO and collected ${money(GO_SALARY)}`);
}

function nearest(from: number, kind: 'railroad' | 'utility'): number {
  const spaces = spacesOfKind(kind);
  return spaces.find(index => index > from) ?? spaces[0];
}

function buildingCounts(state: GameState, seat: Seat): { houses: number; hotels: number } {
  const levels = Object.entries(state.buildings).filter(([space]) => state.owners[Number(space)] === seat).map(([, level]) => level);
  return {
    houses: levels.filter(level => level < HOTEL).reduce((sum, level) => sum + level, 0),
    hotels: levels.filter(level => level === HOTEL).length
  };
}

// The top card is shown, then goes to the bottom of its deck; a Get Out of Jail Free card is kept instead
function drawCard(state: GameState, seat: Seat, deck: DeckName, random: Random): GameState {
  const [index, ...rest] = state.decks[deck];
  if (index === undefined) return state; // both jail cards held and nothing else: unreachable with 16 cards
  const card = DECKS[deck][index];
  const keeps = card.effect.type === 'jailCard';
  const drawn = note({
    ...state,
    decks: { ...state.decks, [deck]: keeps ? rest : [...rest, index] },
    drawnCard: { deck, index, seat }
  }, `${nameOf(state, seat)} drew ${DECK_NAMES[deck]}: ${card.text}`);
  const name = nameOf(state, seat);
  const others = inGame(state).filter(other => other !== seat);
  const effect = card.effect;

  switch (effect.type) {
    case 'advance':
      return landOn(moveTo(drawn, seat, effect.to), seat, random, 'normal');
    case 'nearest': {
      const moved = moveTo(drawn, seat, nearest(state.positions[seat], effect.kind));
      return landOn(moved, seat, random, effect.kind === 'railroad' ? 'doubleRailroad' : 'utilityTimesTen');
    }
    case 'back': {
      const to = (state.positions[seat] - effect.spaces + BOARD_SIZE) % BOARD_SIZE;
      const moved = note({ ...drawn, positions: { ...drawn.positions, [seat]: to } }, `${name} moved back to ${BOARD[to].name}`);
      return landOn(moved, seat, random, 'normal');
    }
    case 'goToJail':
      return sendToJail(drawn, seat);
    case 'jailCard':
      return { ...drawn, jailCards: { ...drawn.jailCards, [seat]: [...(drawn.jailCards[seat] ?? []), deck] } };
    case 'collect':
      return giveCash(drawn, seat, effect.amount);
    case 'pay':
      return charge(drawn, seat, null, effect.amount, DECK_NAMES[deck]);
    case 'payEach':
      return others.reduce((next, other) => charge(next, seat, other, effect.amount, DECK_NAMES[deck]), drawn);
    case 'collectEach':
      return others.reduce((next, other) => charge(next, other, seat, effect.amount, DECK_NAMES[deck]), drawn);
    case 'repairs': {
      const { houses, hotels } = buildingCounts(state, seat);
      return charge(drawn, seat, null, houses * effect.house + hotels * effect.hotel, 'repairs');
    }
  }
}

// What happens on the space `seat` now stands on
function landOn(state: GameState, seat: Seat, random: Random, landing: Landing): GameState {
  const space = state.positions[seat];
  const target = BOARD[space];
  const name = nameOf(state, seat);
  switch (target.kind) {
    case 'goToJail':
      return sendToJail(state, seat);
    case 'tax':
      return charge(state, seat, null, target.amount, target.name);
    case 'card':
      return drawCard(state, seat, target.deck, random);
    case 'go':
    case 'jail':
    case 'parking':
      return state;
  }

  const property = ownable(space);
  const owner = state.owners[space];
  if (!property) return state;
  if (owner === undefined) {
    return note({ ...state, pendingBuy: space }, `${name} may buy ${property.name} for ${money(property.price)}`);
  }
  if (owner === seat) return state;
  if (state.mortgaged.includes(space)) return note(state, `${property.name} is mortgaged, so no rent is due`);

  if (landing === 'utilityTimesTen') {
    const dice = rollDice(random);
    const rolled = note({ ...state, dice }, `${name} threw ${dice[0]} and ${dice[1]} for the utility`);
    return charge(rolled, seat, owner, total(dice) * 10, `rent for ${property.name}`);
  }
  const rent = rentFor(state, space, total(state.dice)) * (landing === 'doubleRailroad' ? 2 : 1);
  return charge(state, seat, owner, rent, `rent for ${property.name}`);
}

function moveBy(state: GameState, seat: Seat, steps: number, random: Random): GameState {
  return landOn(moveTo(state, seat, (state.positions[seat] + steps) % BOARD_SIZE), seat, random, 'normal');
}

// Doubles out of jail move the player but give no extra roll. After a third failed roll the fine is paid and the player moves.
function rollInJail(state: GameState, seat: Seat, dice: [number, number], random: Random): GameState {
  const name = nameOf(state, seat);
  const failed = (state.jailed[seat] ?? 0) + 1;
  if (dice[0] === dice[1]) {
    return moveBy(note(leaveJail(state, seat), `${name} rolled doubles and left Jail`), seat, total(dice), random);
  }
  if (failed >= MAX_JAIL_ROLLS) {
    const fined = charge(note(leaveJail(state, seat), `${name} failed a third time and must pay the fine`), seat, null, JAIL_FINE, 'Jail fine');
    return moveBy(fined, seat, total(dice), random);
  }
  return note({ ...state, jailed: { ...state.jailed, [seat]: failed } }, `${name} stays in Jail`);
}

// One roll of the turn: doubles roll again, and a third doubles in a row goes straight to jail without moving
export function roll(state: GameState, seat: Seat, random: Random): GameState {
  const dice = rollDice(random);
  const doubles = dice[0] === dice[1];
  const rolled = note({ ...state, dice, canRoll: false }, `${nameOf(state, seat)} rolled ${dice[0]} and ${dice[1]}`);
  if (seat in state.jailed) return rollInJail(rolled, seat, dice, random);

  const doublesRolled = doubles ? state.doublesRolled + 1 : 0;
  if (doublesRolled === MAX_DOUBLES) return sendToJail(note(rolled, 'Third doubles in a row'), seat);
  const moved = moveBy({ ...rolled, doublesRolled, canRoll: doubles }, seat, total(dice), random);
  // Going to jail ends the turn, doubles or not
  return seat in moved.jailed ? { ...moved, canRoll: false } : moved;
}
