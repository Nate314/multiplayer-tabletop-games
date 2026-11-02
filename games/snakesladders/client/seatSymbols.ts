import type { SymbolColor } from '../../../src/components/colorSymbols.ts';
import type { Seat } from '../types.ts';

// The color-blind symbol for each seat's color, matching the token colors in snakesladders.scss
export const SEAT_SYMBOLS: Record<Seat, SymbolColor> = { 1: 'red', 2: 'blue', 3: 'green', 4: 'orange', 5: 'purple', 6: 'cyan' };
