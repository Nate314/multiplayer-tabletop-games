import type { DragSourceProps } from '../../../src/drag/useDrag.ts';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { DISC_URL } from '../../../src/components/pieces.ts';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import type { Seat } from '../types.ts';

type PawnProps = {
  seat: Seat;
  name: string;
  dragProps?: DragSourceProps;
};

export default function Pawn({ seat, name, dragProps }: PawnProps) {
  return (
    <div className={`pawn player${seat}`} title={name} data-anim-key={`pawn-${seat}`} {...dragProps}>
      <ServerSvg url={DISC_URL} className="piece-art" />
      <ColorSymbol color={SEAT_SYMBOLS[seat]} className="pawn-symbol" />
      {name?.[0] || `P${seat}`}
    </div>
  );
}
