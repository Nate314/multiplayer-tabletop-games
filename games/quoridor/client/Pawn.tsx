import type { Seat } from '../types.ts';

type PawnProps = {
  seat: Seat;
  name: string;
};

export default function Pawn({ seat, name }: PawnProps) {
  return (
    <div className={`pawn player${seat}`} title={name} data-anim-key={`pawn-${seat}`}>
      {name?.[0] || `P${seat}`}
    </div>
  );
}
