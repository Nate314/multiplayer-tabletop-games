import Tile from './Tile';
import { squareKey } from './animateMove.ts';
import { CENTER, premiumAt } from '../rules.ts';
import type { Board as BoardCells, Placement } from '../types.ts';
import type { DragSourceProps } from '../../../src/drag/useDrag.ts';

type BoardProps = {
  board: BoardCells;
  pending?: Placement[]; // tiles placed this turn but not yet played
  highlighted?: Placement[]; // the last play's tiles
  onSquare?: (row: number, col: number) => void; // left out, the board is read-only and no square is a drop target
  sourceProps?: (row: number, col: number) => DragSourceProps | undefined; // drag props for a square whose tile can be lifted
};

const has = (tiles: Placement[], row: number, col: number) => tiles.some(tile => tile.row === row && tile.col === col);

// The 15x15 board, scaled to the width it is given
export default function Board({ board, pending = [], highlighted = [], onSquare, sourceProps }: BoardProps) {
  return (
    <div className="board-wrap hand-only-board">
      <div className="board">
        {board.map((cells, row) => cells.map((cell, col) => {
          const premium = premiumAt(row, col);
          const placed = pending.find(tile => tile.row === row && tile.col === col);
          const isCenter = row === CENTER && col === CENTER;
          const classes = ['square', premium ? `square-${premium.toLowerCase()}` : '', isCenter ? 'square-center' : ''];

          let content = null;
          if (cell) {
            content = (
              <Tile
                letter={cell.letter}
                blank={cell.blank}
                className={has(highlighted, row, col) ? 'tile-last' : ''}
                animKey={squareKey(row, col)}
              />
            );
          } else if (placed) {
            content = <Tile letter={placed.letter} blank={placed.blank} className="tile-pending" animKey={squareKey(row, col)} />;
          } else if (isCenter) {
            content = <span className="square-label square-star">★</span>;
          } else if (premium) {
            content = <span className="square-label">{premium}</span>;
          }

          return (
            <button
              key={`${row},${col}`}
              type="button"
              className={classes.filter(Boolean).join(' ')}
              disabled={!onSquare || cell !== null}
              aria-label={`Row ${row + 1}, column ${col + 1}`}
              onClick={() => onSquare?.(row, col)}
              data-drop={onSquare ? `square-${row}-${col}` : undefined}
              {...sourceProps?.(row, col)}
            >
              {content}
            </button>
          );
        }))}
      </div>
    </div>
  );
}
