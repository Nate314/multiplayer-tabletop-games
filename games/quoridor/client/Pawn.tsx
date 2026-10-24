import type { DragSourceProps } from '../../../src/drag/useDrag.ts';
import type { Seat } from '../types.ts';

type PawnProps = {
  seat: Seat;
  name: string;
  dragProps?: DragSourceProps;
};

export default function Pawn({ seat, name, dragProps }: PawnProps) {
  return (
    <div className={`pawn player${seat}`} title={name} data-anim-key={`pawn-${seat}`} {...dragProps}>
      {name?.[0] || `P${seat}`}
    </div>
  );
}
