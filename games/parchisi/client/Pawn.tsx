import type { DragSourceProps } from '../../../src/drag/useDrag.ts';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { pawnKey } from './animateMove.ts';
import type { Seat } from '../types.ts';

type PawnProps = {
  seat: Seat;
  pawn: number;
  name: string;
  movable: boolean;
  selected: boolean;
  dragProps?: DragSourceProps;
};

export default function Pawn({ seat, pawn, name, movable, selected, dragProps }: PawnProps) {
  const classNames = ['pawn', `player${seat}`];
  if (movable) classNames.push('movable');
  if (selected) classNames.push('selected');
  return (
    <span className={classNames.join(' ')} title={name} data-anim-key={pawnKey(seat, pawn)} {...dragProps}>
      <ColorSymbol color={SEAT_SYMBOLS[seat]} className="pawn-symbol" />
    </span>
  );
}
