import { cellName, colOf, peers, rowOf } from '../grid.ts';

type GridProps = {
  givens: readonly number[];
  entries: readonly number[];
  notes: readonly number[]; // the viewer's pencil marks, bit d for digit d; a missing cell has none
  wrong: readonly number[];
  selected: number | null;
  lastCell: number | null;
  onSelect?: (cell: number) => void; // without it the grid is read-only
};

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
// Each third of the grid is set off by a thin spacer track, which shows as a thicker line
const track = (index: number) => index + 1 + Math.floor(index / 3);

// The 9x9 grid: every cell a button, givens bold and never selectable
export default function Grid({ givens, entries, notes, wrong, selected, lastCell, onSelect }: GridProps) {
  const selectedDigit = selected === null ? 0 : givens[selected] || entries[selected];
  const related = selected === null ? [] : peers(selected);

  return (
    <div className="sudoku-grid" role="group" aria-label="Sudoku grid">
      {givens.map((given, cell) => {
        const digit = given || entries[cell];
        const isWrong = !given && wrong.includes(cell);
        const classNames = ['cell'];
        if (given) classNames.push('given');
        if (cell === selected) classNames.push('selected');
        if (related.includes(cell)) classNames.push('related');
        if (digit && digit === selectedDigit && cell !== selected) classNames.push('same-digit');
        if (isWrong) classNames.push('wrong');
        if (cell === lastCell) classNames.push('last-move');
        const mask = digit ? 0 : notes[cell] ?? 0;
        const marks = DIGITS.filter(d => mask & (1 << d));
        return (
          <button
            key={cell}
            type="button"
            className={classNames.join(' ')}
            style={{ gridRow: track(rowOf(cell)), gridColumn: track(colOf(cell)) }}
            data-cell={cell}
            aria-label={`${capitalized(cellName(cell))}, ${digit || 'empty'}${isWrong ? ', wrong' : ''}${marks.length ? `, notes ${marks.join(' ')}` : ''}`}
            aria-pressed={onSelect && !given ? cell === selected : undefined}
            disabled={!onSelect || !!given}
            onClick={() => onSelect?.(cell)}
          >
            {digit ? digit : mask ? (
              <span className="notes" aria-hidden="true">
                {DIGITS.map(d => <span key={d}>{mask & (1 << d) ? d : ''}</span>)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
