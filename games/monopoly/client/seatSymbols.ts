import type { SymbolColor } from '../../../src/components/colorSymbols.ts';
import type { Seat } from '../types.ts';

// The color-blind symbol for each seat's token color; seats 7 and 8 (brown, slate) have none
export const SEAT_SYMBOLS: Partial<Record<Seat, SymbolColor>> = { 1: 'red', 2: 'blue', 3: 'green', 4: 'orange', 5: 'purple', 6: 'cyan' };
