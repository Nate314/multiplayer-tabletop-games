import { useState } from 'react';
import { COLORS, NUMBERS, ROOK, cardName, sameCard } from '../rules.ts';
import type { Card } from '../types.ts';

type CallPartnerProps = {
  hand: Card[];
  laidAside: Card[]; // may be called, but not offered first
  count: number; // how many cards to call
  onCall: (cards: Card[]) => void;
};

// Every card the bidder does not hold, highest first: the Rook, then each color from 14 down
function callable(hand: Card[]): Card[] {
  const deck = [ROOK, ...COLORS.flatMap(color => [...NUMBERS].reverse().map((number): Card => ({ color, number })))];
  return deck.filter(card => !hand.some(held => sameCard(held, card)));
}

// The bidder picks the cards to call, one list each, then clicks Call. Each list starts on the highest card someone
// else holds; a laid-aside card may still be picked, to play with fewer partners or alone
export default function CallPartner({ hand, laidAside, count, onCall }: CallPartnerProps) {
  const cards = callable(hand);
  const [picked, setPicked] = useState<string[]>(() =>
    cards.filter(card => !laidAside.some(aside => sameCard(aside, card))).slice(0, count).map(cardName));
  const chosen = picked.map(name => cards.find(card => cardName(card) === name)).filter(card => card !== undefined);
  const different = new Set(picked).size === picked.length;

  return (
    <div className="call-partner" role="group" aria-label="Call a partner">
      {picked.map((name, slot) => (
        <select key={slot} aria-label={`Called card ${slot + 1}`} value={name}
          onChange={event => setPicked(names => names.map((other, index) => (index === slot ? event.target.value : other)))}>
          {cards.map(card => <option key={cardName(card)} value={cardName(card)}>{cardName(card)}</option>)}
        </select>
      ))}
      <button type="button" disabled={!different || chosen.length !== count} onClick={() => onCall(chosen)}>Call</button>
    </div>
  );
}
