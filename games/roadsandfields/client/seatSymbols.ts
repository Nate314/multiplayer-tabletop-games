import type { SymbolColor } from '../../../src/components/colorSymbols.ts';
import type { Seat } from '../types.ts';

// The color-blind symbol for each seat's meeple color
export const SEAT_SYMBOLS: Record<Seat, SymbolColor> = { 1: 'red', 2: 'blue', 3: 'yellow', 4: 'green', 5: 'black' };
