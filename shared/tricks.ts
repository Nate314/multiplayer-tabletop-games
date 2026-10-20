import type { Seat } from './types.ts';

export type Play<C> = { seat: Seat; card: C };

// Whether a card may be played: anything on an empty trick, else the led suit, else anything if the hand is void in it
export function canFollow<C, S>(hand: readonly C[], card: C, trick: readonly Play<C>[], suitOf: (card: C) => S): boolean {
  if (trick.length === 0) return true;
  const led = suitOf(trick[0].card);
  return suitOf(card) === led || !hand.some(held => suitOf(held) === led);
}

// The seat of the highest trump played, else of the highest card of the suit led
export function trickWinner<C, S>(trick: readonly Play<C>[], suitOf: (card: C) => S, rank: (card: C) => number, trump: S | null): Seat {
  if (trick.length === 0) throw new Error('A trick needs at least one play');
  const led = suitOf(trick[0].card);
  // Trump beats the led suit, and anything else never wins
  const strength = (card: C) => (suitOf(card) === trump ? 2000 : suitOf(card) === led ? 1000 : 0) + rank(card);
  return trick.reduce((best, play) => (strength(play.card) > strength(best.card) ? play : best)).seat;
}

// A play's move text with who took the trick when it completed one, e.g. 'Dan played x; Bob took the trick'
export function describeTrickPlay(played: string, player: Seat, trickWinner: Seat | null, playerNames: Record<Seat, string>): string {
  if (trickWinner === null) return played;
  return trickWinner === player ? `${played} and took the trick` : `${played}; ${playerNames[trickWinner]} took the trick`;
}
