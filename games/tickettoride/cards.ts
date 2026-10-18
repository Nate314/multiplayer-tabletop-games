// The 110 train cards, the face-up market, and drawing from the deck with its reshuffles
import { shuffle } from '../../shared/shuffle.ts';
import type { Card, Hand, Random, TrainColor } from './types.ts';

export const TRAIN_COLORS: readonly TrainColor[] = ['pink', 'white', 'blue', 'yellow', 'orange', 'black', 'red', 'green'];
export const CARDS: readonly Card[] = [...TRAIN_COLORS, 'locomotive'];
export const CARDS_PER_COLOR = 12;
export const LOCOMOTIVES = 14;
export const MARKET_SIZE = 5;
// Three face-up locomotives clear the market; this many tries in a row and the market is left as it is
export const MAX_MARKET_RESETS = 10;

export function fullDeck(): Card[] {
  return [...TRAIN_COLORS.flatMap(color => Array<Card>(CARDS_PER_COLOR).fill(color)), ...Array<Card>(LOCOMOTIVES).fill('locomotive')];
}

export function emptyHand(): Hand {
  return { pink: 0, white: 0, blue: 0, yellow: 0, orange: 0, black: 0, red: 0, green: 0, locomotive: 0 };
}

export function handSize(hand: Hand): number {
  return CARDS.reduce((total, card) => total + hand[card], 0);
}

export function addToHand(hand: Hand, card: Card, count = 1): Hand {
  return { ...hand, [card]: hand[card] + count };
}

export function handCards(hand: Hand): Card[] {
  return CARDS.flatMap(card => Array<Card>(hand[card]).fill(card));
}

// The cards that are not in anyone's hand: the deck, its discards and the face-up row
export type Supply = { deck: Card[]; discards: Card[]; faceUp: (Card | null)[] };

// Takes the top card, shuffling the discards into a new deck first when the deck is empty; null when both are empty
export function drawTop<S extends Supply>(supply: S, random: Random): { supply: S; card: Card | null } {
  let { deck, discards } = supply;
  if (deck.length === 0) {
    deck = shuffle(discards, random);
    discards = [];
  }
  if (deck.length === 0) return { supply: { ...supply, deck, discards }, card: null };
  return { supply: { ...supply, deck: deck.slice(0, -1), discards }, card: deck[deck.length - 1] };
}

const locomotivesUp = (faceUp: (Card | null)[]) => faceUp.filter(card => card === 'locomotive').length;

// Fills every empty slot from the deck. While three or more face-up cards are locomotives, all five are discarded and
// five more are turned up. `reset` is true when that happened.
export function refillMarket<S extends Supply>(supply: S, random: Random): { supply: S; reset: boolean } {
  let next = fillSlots(supply, random);
  let reset = false;
  for (let tries = 0; tries < MAX_MARKET_RESETS && locomotivesUp(next.faceUp) >= 3; tries++) {
    const cleared = next.faceUp.filter((card): card is Card => card !== null);
    const others = [...next.deck, ...next.discards, ...cleared].filter(card => card !== 'locomotive').length;
    if (others < 3) break; // too few other cards left for any market without three locomotives
    next = fillSlots({ ...next, discards: [...next.discards, ...cleared], faceUp: next.faceUp.map(() => null) }, random);
    reset = true;
  }
  return { supply: next, reset };
}

function fillSlots<S extends Supply>(supply: S, random: Random): S {
  let next = supply;
  const faceUp = [...supply.faceUp];
  for (let slot = 0; slot < MARKET_SIZE; slot++) {
    if (faceUp[slot] !== null && faceUp[slot] !== undefined) continue;
    const drawn = drawTop(next, random);
    next = drawn.supply;
    faceUp[slot] = drawn.card;
  }
  return { ...next, faceUp };
}
