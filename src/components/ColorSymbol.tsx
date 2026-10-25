import type { SVGProps } from 'react';
import usePreferences from '../hooks/usePreferences.ts';
import ServerSvg from '../assets/ServerSvg.tsx';
import { svgUrl } from '../assets/svgCache.ts';
import { COLOR_SYMBOLS } from './colorSymbols.ts';
import type { SymbolColor } from './colorSymbols.ts';

// A shape that stands for a player color, shown only while Color-blind symbols is on.
// With svgProps it sits inside an SVG board, placed and sized by them
export default function ColorSymbol({ color, className, svgProps }: { color: SymbolColor | null | undefined; className?: string; svgProps?: SVGProps<SVGSVGElement> }) {
  const { colorSymbols } = usePreferences();
  if (!colorSymbols || !color) return null;
  const shape = COLOR_SYMBOLS[color];
  const classes = ['color-symbol', `color-symbol-${shape}`, className].filter(Boolean).join(' ');
  return <ServerSvg url={svgUrl('color-symbol', shape)} className={classes} inSvg={svgProps !== undefined} svgProps={svgProps} />;
}
