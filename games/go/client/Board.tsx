import { useState, type KeyboardEvent } from 'react';
import { COLUMNS, pointName, starPoints } from '../board.ts';
import { ownerMap } from '../scoring.ts';
import { pointKey } from './animateMove.ts';
import type { Point, PublicGameState, Stone } from '../types.ts';

const STONE_RADIUS = 0.47;

type BoardProps = {
  gameState: PublicGameState;
  ghost?: Stone | null; // the color a hovered legal point previews (mouse only)
  isLegal?: (point: Point) => boolean;
  onPoint?: (point: Point) => void; // without it the board is read only
};

const onKey = (action: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

const same = (a: Point) => (b: Point) => a.row === b.row && a.col === b.col;

// One inline SVG in point units: point (row, col) sits at x = col, y = row, with a one point margin for the coordinates
export default function Board({ gameState, ghost = null, isLegal, onPoint }: BoardProps) {
  const [hovered, setHovered] = useState<Point | null>(null);
  const { size, board, dead, phase, lastMove } = gameState;
  const indexes = Array.from({ length: size }, (_, index) => index);
  const end = size - 1;
  const last = lastMove?.type === 'place' ? lastMove.point : null;
  // A resignation ends play with no count, so its leftover marks are not drawn
  const marking = phase === 'marking' && (!gameState.isGameOver || gameState.score !== null);
  const owners = marking ? ownerMap(board, dead) : null;
  const grid = indexes.map(i => `M0 ${i}H${end}M${i} 0V${end}`).join('');
  const label = { className: 'go-coord', textAnchor: 'middle', dominantBaseline: 'central' } as const;

  function point(row: number, col: number) {
    const here = { row, col };
    const stone = board[row][col];
    const isLast = stone !== null && last !== null && same(last)(here);
    const isDead = marking && stone !== null && dead.some(same(here));
    const owner = !stone && owners ? owners[row][col] : null;
    const showGhost = !stone && ghost && hovered && same(hovered)(here) && isLegal?.(here);
    const name = `${pointName(here, size)}, ${stone ?? 'empty'}${isLast ? ', last move' : ''}${isDead ? ', marked dead' : ''}`;
    const click = () => onPoint?.(here);
    return (
      <g
        key={`${row}-${col}`}
        className={onPoint ? 'go-point clickable' : 'go-point'}
        role="button"
        tabIndex={onPoint ? 0 : -1}
        aria-label={name}
        onClick={click}
        onKeyDown={onKey(click)}
        onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(here); }}
        onPointerLeave={() => setHovered(null)}
      >
        <rect className="go-hit" x={col - 0.5} y={row - 0.5} width={1} height={1} />
        {owner && <rect className={`go-territory ${owner}`} x={col - 0.15} y={row - 0.15} width={0.3} height={0.3} />}
        {stone && (
          <circle className={`go-stone ${stone}${isDead ? ' dead' : ''}`} data-anim-key={pointKey(here)} cx={col} cy={row} r={STONE_RADIUS} />
        )}
        {isDead && <path className={`go-cross ${stone}`} d={`M${col - 0.2} ${row - 0.2}l0.4 0.4m0 -0.4l-0.4 0.4`} />}
        {isLast && <circle className={`go-last ${stone}`} cx={col} cy={row} r={0.22} />}
        {showGhost && <circle className={`go-stone go-ghost ${ghost}`} cx={col} cy={row} r={STONE_RADIUS} />}
      </g>
    );
  }

  return (
    <svg className="go-board" viewBox={`-1 -1 ${size + 1} ${size + 1}`} role="group" aria-label={`${size} by ${size} Go board`}>
      <rect className="go-wood" x={-1} y={-1} width={size + 1} height={size + 1} rx={0.3} />
      <path className="go-grid" d={grid} />
      {starPoints(size).map(({ row, col }) => <circle key={`star-${row}-${col}`} className="go-star" cx={col} cy={row} r={0.1} />)}
      {indexes.map(i => (
        <g key={`coord-${i}`} aria-hidden="true">
          <text {...label} x={i} y={-0.62}>{COLUMNS[i]}</text>
          <text {...label} x={i} y={end + 0.62}>{COLUMNS[i]}</text>
          <text {...label} x={-0.62} y={i}>{size - i}</text>
          <text {...label} x={end + 0.62} y={i}>{size - i}</text>
        </g>
      ))}
      {indexes.map(row => indexes.map(col => point(row, col)))}
    </svg>
  );
}
