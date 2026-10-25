import type { DragSourceProps } from '../../../src/drag/useDrag.ts';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
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
      <ColorSymbol color={SEAT_SYMBOLS[seat]} className="pawn-symbol" />
      {name?.[0] || `P${seat}`}
    </div>
  );
}
