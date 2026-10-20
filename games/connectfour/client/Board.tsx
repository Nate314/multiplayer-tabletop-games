import { cellKey } from './animateMove.ts';
import { COLUMNS, ROWS, SEAT_COLORS, isColumnFull } from '../rules.ts';
import type { Position, PublicGameState } from '../types.ts';

const ROW_INDEXES = Array.from({ length: ROWS }, (_, index) => index);
const COLUMN_INDEXES = Array.from({ length: COLUMNS }, (_, index) => index);

type BoardProps = {
  gameState: PublicGameState;
  dimmed: boolean;
  droppable: boolean; // whether the viewer may drop a disc now
  onDrop: (column: number) => void;
};

const isWinning = (line: Position[] | null, row: number, col: number) => !!line?.some(cell => cell.row === row && cell.col === col);

export default function Board({ gameState, dimmed, droppable, onDrop }: BoardProps) {
  const { board, lastMove, winningLine } = gameState;
  const canDrop = (column: number) => droppable && !isColumnFull(board, column);

  return (
    <div className="board-frame">
      <div className="drop-row">
        {COLUMN_INDEXES.map(column => (
          <button
            key={column}
            type="button"
            className="drop-button"
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
          if (lastMove?.row === row && lastMove.column === column) classNames.push('last-move');
          if (isWinning(winningLine, row, column)) classNames.push('winning');
          return (
            <div
              key={`${row}-${column}`}
              className={classNames.join(' ')}
              data-anim-key={cellKey({ row, col: column })}
              onClick={() => canDrop(column) && onDrop(column)}
            >
              {seat && <div className={`disc player${seat}`} aria-label={`${SEAT_COLORS[seat]} disc`} />}
            </div>
          );
        }))}
      </div>
    </div>
  );
}
