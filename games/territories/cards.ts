// Territory cards: drawing one after a turn with a conquest, trading sets for armies, and taking an eliminated player's cards
import { shuffle } from '../../shared/shuffle.ts';
import { cardName, cardSymbol, cardTerritory, territoryName } from './map.ts';
import { nameOf, note, plural } from './state.ts';
import type { Card, GameState, Random, Result, Seat } from './types.ts';

// A player holding this many cards at the start of their turn must trade
export const MUST_TRADE_AT = 5;
// Taking an eliminated player's cards leaves this many or more: trade at once, down to MUST_TRADE_AT - 1
export const TRADE_AFTER_TAKING_AT = 6;
export const TERRITORY_BONUS = 2;

const FIRST_VALUES = [4, 6, 8, 10, 12, 15];

// The armies the set traded after `traded` earlier sets is worth: 4, 6, 8, 10, 12, 15, then 5 more each time
export function setValue(traded: number): number {
  return FIRST_VALUES[traded] ?? FIRST_VALUES[FIRST_VALUES.length - 1] + 5 * (traded - FIRST_VALUES.length + 1);
}

// Three of a kind, one of each, or any two with a wild
export function isSet(cards: readonly Card[]): boolean {
  if (cards.length !== 3) return false;
  const symbols = cards.map(cardSymbol).filter(symbol => symbol !== 'wild');
  if (symbols.length < 3) return true;
  const kinds = new Set(symbols).size;
  return kinds === 1 || kinds === 3;
}

// Whether the current player must trade before placing armies
export function mustTrade(state: GameState, seat: Seat): boolean {
  return state.phase === 'reinforce' && (state.hands[seat]?.length ?? 0) >= MUST_TRADE_AT;
}

// Trades three cards for armies to place. The first traded card showing a territory the player holds puts 2 more
// armies there, once a turn.
export function tradeCards(state: GameState, seat: Seat, cards: Card[]): Result<GameState> {
  if (state.phase !== 'reinforce') return { error: 'Trade cards while placing armies, at the start of your turn' };
  const hand = state.hands[seat] ?? [];
  if (state.midTurnTrade && hand.length < MUST_TRADE_AT) return { error: 'You hold fewer than 5 cards: place your armies' };
  if (new Set(cards).size !== 3 || !cards.every(card => hand.includes(card))) return { error: 'Choose three of your cards' };
  if (!isSet(cards)) return { error: 'Those cards are not a set: three alike, one of each, or two with a wild' };
  const value = setValue(state.tradeCount);
  let next: GameState = {
    ...state,
    hands: { ...state.hands, [seat]: hand.filter(card => !cards.includes(card)) },
    discard: [...state.discard, ...cards],
    tradeCount: state.tradeCount + 1,
    reinforcements: state.reinforcements + value
  };
  next = note(next, `${nameOf(state, seat)} traded ${cards.map(cardName).join(', ')} for ${plural(value, 'army', 'armies')}`);
  const owned = state.bonusTaken ? null : cards.map(cardTerritory).find(id => id !== null && state.owners[id] === seat) ?? null;
  if (owned) {
    next = { ...next, bonusTaken: true, armies: { ...next.armies, [owned]: next.armies[owned] + TERRITORY_BONUS } };
    next = note(next, `${nameOf(state, seat)} put ${TERRITORY_BONUS} more armies on ${territoryName(owned)}, shown on a traded card`);
  }
  return { state: next };
}

// The current player draws a card, reshuffling the discards when the deck runs out; with none anywhere they get none
export function drawCard(state: GameState, seat: Seat, random: Random): GameState {
  let { deck, discard } = state;
  if (deck.length === 0) {
    deck = shuffle(discard, random);
    discard = [];
  }
  const [card, ...rest] = deck;
  if (card === undefined) return note(state, 'No cards are left to draw');
  const drawn = { ...state, deck: rest, discard, hands: { ...state.hands, [seat]: [...(state.hands[seat] ?? []), card] } };
  return note(drawn, `${nameOf(state, seat)} drew a card`);
}

// The conqueror takes every card of the player they eliminated
export function takeCards(state: GameState, from: Seat, to: Seat): GameState {
  const taken = state.hands[from] ?? [];
  const hands = { ...state.hands, [from]: [], [to]: [...(state.hands[to] ?? []), ...taken] };
  return note({ ...state, hands }, `${nameOf(state, to)} took ${plural(taken.length, 'card')} from ${nameOf(state, from)}`);
}
