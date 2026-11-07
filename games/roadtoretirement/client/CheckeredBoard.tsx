import { GOAL_POINTS, SQUARES, cellOf, isLight, type Square } from '../checkered.ts';
import type { Cell, Move, PublicGameState, Seat } from '../types.ts';
import { pieceKey } from './animateMove.ts';

const CELLS: Cell[] = Array.from({ length: 64 }, (_, i) => ({ row: Math.floor(i / 8), col: i % 8 }));
const same = (a: Cell, b: Cell): boolean => a.row === b.row && a.col === b.col;

function note(square: Square): string {
  if (square.goal) return `+${GOAL_POINTS}, the goal`;
  if (square.points) return `+${square.points}`;
  if (square.sendTo) return `to ${square.sendTo}`;
  if (square.loseTurn) return 'lose a turn';
  if (square.despair) return 'back to Infancy';
  if (square.speculation) return 'spin: Wealth or Ruin';
  return square.name === 'Infancy' ? 'start' : '';
}

// One arrow per send, from the square's middle toward its target, stopping short of both names
function arrow(from: Cell, to: Cell) {
  const [x1, y1, x2, y2] = [from.col + 0.5, from.row + 0.5, to.col + 0.5, to.row + 0.5];
  const length = Math.hypot(x2 - x1, y2 - y1);
  const trim = 0.32 / length;
  return { x1: x1 + (x2 - x1) * trim, y1: y1 + (y2 - y1) * trim, x2: x2 - (x2 - x1) * trim, y2: y2 - (y2 - y1) * trim };
}
const ARROWS = Object.entries(SQUARES).filter(([, square]) => square.sendTo).map(([key, square]) => {
  const [row, col] = key.split(',').map(Number);
  return { key, ...arrow({ row, col }, cellOf(square.sendTo!)) };
});

type Props = { gameState: PublicGameState; canMove: boolean; onMove: (move: Move) => void; highlight: Cell | null };

// The 1860 board: the named light squares, an arrow for each send, the pieces, and the squares the spin allows
export default function CheckeredBoard({ gameState, canMove, onMove, highlight }: Props) {
  const board = gameState.checkered;
  const options = board?.phase === 'choose' ? board.options : [];
  const pieces = Object.entries(board?.pieces ?? {}).map(([seat, cell]) => ({ seat: Number(seat), cell }));

  return (
    <div className="checkered-board">
      {CELLS.map(cell => {
        const { row, col } = cell;
        const square = SQUARES[`${row},${col}`];
        const legal = options.some(option => same(option, cell));
        const classNames = ['cell', isLight(cell) ? 'light' : 'dark'];
        if (legal) classNames.push('legal');
        if (highlight && same(highlight, cell)) classNames.push('highlight');
        const here = pieces.filter(piece => same(piece.cell, cell));
        const content = (
          <>
            {square && <span className="square-name">{square.name}</span>}
            {square && <span className="square-note">{note(square)}</span>}
            {here.length > 0 && (
              <span className="pieces">
                {here.map(({ seat }) => (
                  <span key={seat} className={`piece seat${seat}`} data-anim-key={pieceKey(seat)} title={gameState.playerNames[seat]}>
                    {gameState.playerNames[seat]?.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </span>
            )}
          </>
        );
        const data = { className: classNames.join(' '), 'data-row': row, 'data-col': col, 'data-legal': legal ? 'true' : undefined };
        return legal && canMove ? (
          <button key={`${row},${col}`} type="button" {...data} aria-label={`Move to ${square?.name ?? `row ${row + 1}, column ${col + 1}`}`}
            onClick={() => onMove({ type: 'step', to: cell })}>
            {content}
          </button>
        ) : <div key={`${row},${col}`} {...data}>{content}</div>;
      })}
      <svg className="send-arrows" viewBox="0 0 8 8" aria-hidden="true">
        <defs>
          <marker id="rtr-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" />
          </marker>
        </defs>
        {ARROWS.map(({ key, ...line }) => <line key={key} {...line} markerEnd="url(#rtr-arrowhead)" />)}
      </svg>
    </div>
  );
}
