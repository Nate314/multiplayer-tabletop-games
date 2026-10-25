// The color-blind symbol table: each player color has one shape, drawn in a 24 by 24 box
export type SymbolColor = 'red' | 'blue' | 'green' | 'yellow' | 'black' | 'white' | 'orange' | 'pink' | 'purple' | 'cyan';

export type SymbolShape = 'circle' | 'square' | 'triangle' | 'star' | 'diamond' | 'ring' | 'hexagon' | 'heart' | 'cross' | 'pentagon';

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

// Filled shapes; the ring is a circle with a hole, so it needs fill-rule evenodd
export const SHAPE_PATHS: Record<SymbolShape, string> = {
  circle: 'M12 2a10 10 0 1 1 0 20a10 10 0 1 1 0-20z',
  square: 'M3 3h18v18H3z',
  triangle: 'M12 3L22 21H2z',
  star: 'M12 2.5L14.35 9.26L21.51 9.41L15.8 13.74L17.88 20.59L12 16.5L6.12 20.59L8.2 13.74L2.49 9.41L9.65 9.26z',
  diamond: 'M12 2L22 12L12 22L2 12z',
  ring: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10z',
  hexagon: 'M12 2L20.66 7V17L12 22L3.34 17V7z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  pentagon: 'M12 2L21.51 8.91L17.88 20.09H6.12L2.49 8.91z',
};
