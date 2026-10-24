import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import type { Seat } from '../types.ts';

const SHAPE = 'M0,-9 C3,-9 4,-7 4,-5 C4,-4 3.5,-3 3,-2.5 L8,-1 C9.5,-0.5 9.5,1.5 8,2 L4.5,2.5 L7,8 C7.3,9 6.5,9.5 5.5,9.5 ' +
  'L1.5,9.5 L0,6 L-1.5,9.5 L-5.5,9.5 C-6.5,9.5 -7.3,9 -7,8 L-4.5,2.5 L-8,2 C-9.5,1.5 -9.5,-0.5 -8,-1 L-3,-2.5 ' +
  'C-3.5,-3 -4,-4 -4,-5 C-4,-7 -3,-9 0,-9 Z';

// The shape sits on the meeple's body, upright even on a farmer lying on its side (whose body is to the right)
const SYMBOL_SIZE = 10;
const SYMBOL_CENTER_Y = 2;

// A meeple in the seat's color, centered on x, y in board units; a farmer lies on its side, as the rules have it
export default function Meeple({ seat, x, y, lying = false, size = 1.3 }: { seat: Seat; x: number; y: number; lying?: boolean; size?: number }) {
  const symbolSize = SYMBOL_SIZE * size;
  const shift = SYMBOL_CENTER_Y * size; // from the meeple's middle to its body, along its length
  return (
    <>
      <path
        className={`cc-meeple cc-seat${seat}`}
        d={SHAPE}
        transform={`translate(${x} ${y}) scale(${size})${lying ? ' rotate(-90)' : ''}`}
      />
      <ColorSymbol
        color={SEAT_SYMBOLS[seat]}
        className={`cc-meeple-symbol cc-symbol-seat${seat}`}
        svgProps={{ x: (lying ? x + shift : x) - symbolSize / 2, y: (lying ? y : y + shift) - symbolSize / 2, width: symbolSize, height: symbolSize, style: { width: symbolSize, height: symbolSize } }}
      />
    </>
  );
}

// The same meeple as a small standalone picture, for the player list and buttons
export function MeepleIcon({ seat, title }: { seat: Seat; title?: string }) {
  return (
    <svg className="cc-meeple-icon" viewBox="-10 -10 20 20" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <Meeple seat={seat} x={0} y={0} size={1} />
    </svg>
  );
}
