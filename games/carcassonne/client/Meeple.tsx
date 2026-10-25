import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { meepleUrl } from './pieces.ts';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import type { Seat } from '../types.ts';

// The shape sits on the meeple's body, upright even on a farmer lying on its side (whose body is to the right)
const SYMBOL_SIZE = 10;
const SYMBOL_CENTER_Y = 2;

// A meeple in the seat's color (20 units across), centered on x, y in board units; a farmer lies on its side, as the
// rules have it
export default function Meeple({ seat, x, y, lying = false, size = 1.3 }: { seat: Seat; x: number; y: number; lying?: boolean; size?: number }) {
  const symbolSize = SYMBOL_SIZE * size;
  const shift = SYMBOL_CENTER_Y * size; // from the meeple's middle to its body, along its length
  return (
    <>
      <ServerSvg url={meepleUrl(seat, lying)} inSvg svgProps={{ x: x - 10 * size, y: y - 10 * size, width: 20 * size, height: 20 * size }} />
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
