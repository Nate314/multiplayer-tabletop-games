import { type KeyboardEvent } from 'react';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { SQUARE_STARTS, TRIANGLE_STARTS, boardCells, cellKey, type BoardKind, type Cell } from '../geometry.ts';
import type { PublicGameState } from '../types.ts';
import { SYMBOLS, cellPoints, centerOf, pointsAttr, viewBoxOf } from './draw.ts';

const CELLS: Record<BoardKind, Cell[]> = { squares: boardCells('squares'), triangles: boardCells('triangles') };
const VIEW_BOX: Record<BoardKind, string> = {
  squares: viewBoxOf('squares', CELLS.squares, 0.2),
  triangles: viewBoxOf('triangles', CELLS.triangles, 0.2)
};

type BoardProps = {
  gameState: PublicGameState;
  showLastMove?: boolean;
  preview?: { color: number; cells: Cell[] } | null;
  spots?: Cell[]; // the outlined cells, one per legal spot
  onCell?: (cell: Cell) => void; // a click, a tap or Enter on an outlined cell; without it the board is read only
  onHover?: (cell: Cell) => void; // the mouse entered a cell
};

const onKey = (action: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

// One SVG: squares at (x, y) with size 1, triangle corner (x, y) at (x + y / 2, y * sqrt(3) / 2)
export default function Board({ gameState, showLastMove = false, preview = null, spots = [], onCell, onHover }: BoardProps) {
  const { board: kind, placed, lastMove } = gameState;
  const color = new Map<string, number>(placed.flatMap(p => p.cells.map(c => [cellKey(c), p.color] as const)));
  const last = new Set(showLastMove && lastMove ? lastMove.cells.map(cellKey) : []);
  const ghost = new Set(preview?.cells.map(cellKey));
  const spotKeys = new Set(spots.map(cellKey));
  // Squares: each color's own corner, in its color; triangles: six starting points open to every color
  const starts = new Map<string, string>(kind === 'squares'
    ? SQUARE_STARTS.map((c, i) => [cellKey(c), `corners-c${i}`])
    : TRIANGLE_STARTS.map(c => [cellKey(c), '']));
  const symbolSize = kind === 'squares' ? 0.6 : 0.36;

  return (
    <svg className={`corners-board corners-${kind}`} viewBox={VIEW_BOX[kind]} role="group" aria-label={`Corners board, ${kind}`}>
      {CELLS[kind].map(cell => {
        const key = cellKey(cell);
        const pts = cellPoints(kind, cell);
        const owner = color.get(key);
        const shown = owner ?? (ghost.has(key) ? preview!.color : undefined);
        const isSpot = spotKeys.has(key);
        const start = owner === undefined && starts.has(key);
        const [cx, cy] = centerOf(pts);
        const classes = ['corners-cell'];
        if (shown !== undefined) classes.push('corners-fill', `corners-c${shown}`);
        if (owner === undefined && ghost.has(key)) classes.push('corners-preview');
        if (last.has(key)) classes.push('corners-last');
        if (isSpot) classes.push('corners-spot');
        return (
          <g
            key={key}
            data-cell={key}
            className={classes.join(' ')}
            {...(isSpot && onCell ? { role: 'button', tabIndex: 0, 'aria-label': `Spot ${key}`, onKeyDown: onKey(() => onCell(cell)) } : {})}
            onClick={onCell && (() => onCell(cell))}
            onPointerEnter={onHover && (event => { if (event.pointerType === 'mouse') onHover(cell); })}
          >
            <polygon points={pointsAttr(pts)} />
            {start && <circle className={`corners-start ${starts.get(key)}`} cx={cx} cy={cy} r={symbolSize / 3} />}
            {shown !== undefined && (
              <ColorSymbol
                color={SYMBOLS[shown]}
                className="corners-symbol"
                svgProps={{ x: cx - symbolSize / 2, y: cy - symbolSize / 2, width: symbolSize, height: symbolSize, style: { width: symbolSize, height: symbolSize } }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
