// Data shapes shared by the browser and the server
import type { BaseGameState, BasePublicState, Seat } from '../../shared/types.ts';

export type { Result, Seat } from '../../shared/types.ts';

export type Commodity = 'saffron' | 'silver' | 'coffee' | 'cocoa' | 'copper' | 'sugar' | 'cotton' | 'soy';
export type Card = { id: number; kind: Commodity | 'bull' | 'bear' };
export type Offer = { id: number; seat: Seat; cards: number[] }; // card ids, server side only
export type OpenOffer = { id: number; seat: Seat; count: number }; // what everyone sees
export type Corner = { commodity: Commodity; points: number; double: boolean };
export type RoundSummary = {
  round: number; winner: Seat; corner: Corner; hand: Card[];
  penalties: Partial<Record<Seat, number>>; acknowledged: Seat[];
};
export type LastMove =
  | { type: 'swap'; seats: [Seat, Seat]; count: number }
  | { type: 'corner'; playerNumber: Seat; commodity: Commodity; points: number; double: boolean }
  | null;

export type GameState = BaseGameState & {
  phase: 'trading' | 'summary';
  round: number;
  hands: Partial<Record<Seat, Card[]>>;
  offers: Offer[];
  nextOfferId: number;
  scores: Partial<Record<Seat, number>>;
  summary: RoundSummary | null;
  lastMove: LastMove;
};

export type PublicGameState = Omit<GameState, 'hands' | 'offers'> & BasePublicState & {
  hand: Card[]; // the viewer's own; [] for null
  offering: number[]; // the viewer's own open offer's card ids; [] for null
  offers: OpenOffer[];
  handCounts: Record<Seat, number>;
};
