import PieceTray from '../../../src/components/PieceTray';
import { useDrag } from '../../../src/drag/useDrag.ts';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { cellKey } from './animateMove.ts';
import { COLUMNS, ROWS, SEAT_COLORS, isColumnFull } from '../rules.ts';
import type { Position, PublicGameState, Seat } from '../types.ts';

const ROW_INDEXES = Array.from({ length: ROWS }, (_, index) => index);
const COLUMN_INDEXES = Array.from({ length: COLUMNS }, (_, index) => index);

type BoardProps = {
  gameState: PublicGameState;
  dimmed: boolean;
  droppable: boolean; // whether the viewer may drop a disc now
  onDrop: (column: number) => void;
  seat?: Seat; // the viewer's seat, which colors their disc in the supply; no supply without it
};

const COLUMN_PREFIX = 'column-';

const isWinning = (line: Position[] | null, row: number, col: number) => !!line?.some(cell => cell.row === row && cell.col === col);

export default function Board({ gameState, dimmed, droppable, onDrop, seat }: BoardProps) {
  const { board, lastMove, winningLine } = gameState;
  const canDrop = (column: number) => droppable && !isColumnFull(board, column);

  // The supply is one disc: drag it onto a column. The column is the drop target id.
  const drag = useDrag({
    canLift: () => droppable,
    canDrop: (_id, target) => canDrop(Number(target.slice(COLUMN_PREFIX.length))),
    onDrop: (_id, target) => onDrop(Number(target.slice(COLUMN_PREFIX.length)))
  });
  const overColumn = drag.over?.startsWith(COLUMN_PREFIX) ? Number(drag.over.slice(COLUMN_PREFIX.length)) : null;

  return (
    <div className="board-frame">
      {seat && (
        <PieceTray
          label="Your disc"
          pieces={[{
            id: 'disc',
            label: 'Your disc',
            icon: <div className={`tray-disc player${seat}`} />,
            blocked: droppable ? undefined : 'Wait for your turn'
          }]}
          selected={null}
          onTap={() => {}}
          drag={drag}
        />
      )}
      <div className="drop-row">
        {COLUMN_INDEXES.map(column => (
          <button
            key={column}
            type="button"
            className={`drop-button${overColumn === column ? ' column-over' : ''}`}
            data-drop={`${COLUMN_PREFIX}${column}`}
            aria-label={`Drop in column ${column + 1}`}
            disabled={!canDrop(column)}
            onClick={() => onDrop(column)}
          >
            ▼
          </button>
        ))}
      </div>
      <div className={`board ${dimmed ? 'dimmed' : ''}`}>
        {ROW_INDEXES.map(row => COLUMN_INDEXES.map(column => {
          const seat = board[row][column];
          const classNames = ['cell'];
          if (overColumn === column) classNames.push('column-over');
          if (lastMove?.row === row && lastMove.column === column) classNames.push('last-move');
          if (isWinning(winningLine, row, column)) classNames.push('winning');
          return (
            <div
              key={`${row}-${column}`}
              className={classNames.join(' ')}
              data-anim-key={cellKey({ row, col: column })}
              data-drop={`${COLUMN_PREFIX}${column}`}
              onClick={() => canDrop(column) && onDrop(column)}
            >
              {seat && (
                <div className={`disc player${seat}`} aria-label={`${SEAT_COLORS[seat]} disc`}>
                  <ColorSymbol color={SEAT_SYMBOLS[seat]} className="disc-symbol" />
                </div>
              )}
            </div>
          );
        }))}
      </div>
    </div>
  );
}
