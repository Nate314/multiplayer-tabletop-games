import type { SymbolShape } from '../../shared/svg/symbols.ts';

// The color-blind symbol table: each player color has one shape (drawn by shared/svg/symbols.ts)
export type SymbolColor = 'red' | 'blue' | 'green' | 'yellow' | 'black' | 'white' | 'orange' | 'pink' | 'purple' | 'cyan';

export type { SymbolShape };

export const COLOR_SYMBOLS: Record<SymbolColor, SymbolShape> = {
  red: 'circle',
  blue: 'square',
  green: 'triangle',
  yellow: 'star',
  black: 'diamond',
  white: 'ring',
  orange: 'hexagon',
  pink: 'heart',
  purple: 'cross',
  cyan: 'pentagon',
};
