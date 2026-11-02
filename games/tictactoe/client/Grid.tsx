import Mark from './Mark';
import { CELL_NAMES } from '../lines.ts';
import { markOf } from '../marks.ts';
import type { Seat } from '../types.ts';

type GridProps = {
  cells: readonly (Seat | null)[];
  xSeat: Seat;
  playable: (cell: number) => boolean;
  onPlace: (cell: number) => void;
  lastCell: number | null;
  winningLine: readonly number[] | null;
  keyPrefix: string; // each cell's data-anim-key is `${keyPrefix}-${cell}`
  label: string;
};

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// A 3x3 grid of cells, each a button that is on only while `playable` allows it
export default function Grid({ cells, xSeat, playable, onPlace, lastCell, winningLine, keyPrefix, label }: GridProps) {
  return (
    <div className="ttt-grid" role="group" aria-label={label}>
      {cells.map((seat, cell) => {
        const mark = seat === null ? null : markOf({ xSeat }, seat);
        const classNames = ['cell'];
        if (cell === lastCell) classNames.push('last-move');
        if (winningLine?.includes(cell)) classNames.push('winning');
        return (
          <button
            key={cell}
            type="button"
            className={classNames.join(' ')}
            data-anim-key={`${keyPrefix}-${cell}`}
            aria-label={`${capitalized(CELL_NAMES[cell])}, ${mark ?? 'empty'}`}
            disabled={!playable(cell)}
            onClick={() => onPlace(cell)}
          >
            {mark && <Mark mark={mark} />}
          </button>
        );
      })}
    </div>
  );
}
