import type { Seat } from '../../shared/types.ts';

// The data-anim-key strings the card games share: a hand slot, a seat, a seat's card in the trick
export const handKey = (slot: number) => `hand-${slot}`;
export const seatKey = (seat: Seat) => `seat-${seat}`;
export const trickKey = (seat: Seat) => `trick-${seat}`;
