import { pawnKey } from './animateMove.ts';
import type { Seat } from '../types.ts';

type PawnProps = {
  seat: Seat;
  pawn: number;
  name: string;
  movable: boolean;
  selected: boolean;
};

export default function Pawn({ seat, pawn, name, movable, selected }: PawnProps) {
  const classNames = ['pawn', `player${seat}`];
  if (movable) classNames.push('movable');
  if (selected) classNames.push('selected');
  return <span className={classNames.join(' ')} title={name} data-anim-key={pawnKey(seat, pawn)} />;
}
