import usePreferences from '../hooks/usePreferences.ts';
import { COLOR_SYMBOLS, SHAPE_PATHS } from './colorSymbols.ts';
import type { SymbolColor } from './colorSymbols.ts';

// A shape that stands for a player color, shown only while Color-blind symbols is on
export default function ColorSymbol({ color, className }: { color: SymbolColor | null | undefined; className?: string }) {
  const { colorSymbols } = usePreferences();
  if (!colorSymbols || !color) return null;
  const shape = COLOR_SYMBOLS[color];
  const classes = ['color-symbol', `color-symbol-${shape}`, className].filter(Boolean).join(' ');
  return (
    <svg className={classes} viewBox="0 0 24 24" aria-hidden="true">
      <path d={SHAPE_PATHS[shape]} fillRule="evenodd" />
    </svg>
  );
}
