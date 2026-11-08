import { SEAT_COLORS } from '../../shared/seatColors.ts';
import type { Seat } from '../../shared/types.ts';
import type { SymbolColor } from './colorSymbols.ts';

export { seatColor, seatColorName } from '../../shared/seatColors.ts';

// The color-blind symbol for seats 1 to 8; typing color as SymbolColor fails the build if a seat color has no shape
export const SEAT_SYMBOL_COLORS: Record<Seat, SymbolColor> = Object.fromEntries(SEAT_COLORS.map((color: SymbolColor, i) => [i + 1, color]));

// The CSS variable holding a seat's color, and its darker stroke
export const seatColorVar = (seat: Seat): string => `var(--seat-color-${((seat - 1) % SEAT_COLORS.length) + 1})`;
export const seatStrokeVar = (seat: Seat): string => `var(--seat-stroke-${((seat - 1) % SEAT_COLORS.length) + 1})`;
