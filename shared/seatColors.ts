import type { Seat } from './types.ts';

// Every pawn-and-piece game paints seat N in SEAT_COLORS[N - 1]; the hexes are --seat-color-N in src/App.scss
export const SEAT_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'] as const;
export type SeatColor = (typeof SEAT_COLORS)[number];

export const MAX_COLORED_SEATS = SEAT_COLORS.length;

// Seats past the eighth wrap around, which no game reaches
export const seatColor = (seat: Seat): SeatColor => SEAT_COLORS[(seat - 1) % MAX_COLORED_SEATS];

// 'Red', 'Blue', ... for move text, FAQs and player lists
export const seatColorName = (seat: Seat): string => {
  const color = seatColor(seat);
  return color[0].toUpperCase() + color.slice(1);
};
