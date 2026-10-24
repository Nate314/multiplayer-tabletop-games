import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import type { Seat } from '../types.ts';

type PawnProps = {
  seat: Seat;
  name: string;
};

export default function Pawn({ seat, name }: PawnProps) {
  return (
    <div className={`pawn player${seat}`} title={name} data-anim-key={`pawn-${seat}`}>
      <ColorSymbol color={SEAT_SYMBOLS[seat]} className="pawn-symbol" />
      {name?.[0] || `P${seat}`}
    </div>
  );
}
