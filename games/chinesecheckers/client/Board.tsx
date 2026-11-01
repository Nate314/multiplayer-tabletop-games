import type { CSSProperties, KeyboardEvent } from 'react';
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { HOLES, holeKey, opposite, parseHole, pointOf } from '../board.ts';
import { SEAT_COLORS } from '../rules.ts';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { VIEW_BOX, holeXY, turnsFor } from './geometry.ts';
import { holeAnimKey } from './animateMove.ts';
import { includesHole } from './selection.ts';
import type { Hole, PointIndex, PublicGameState, Seat } from '../types.ts';

const HOLE_RADIUS = 0.5;
const MARBLE_RADIUS = 0.72;
const HIT_RADIUS = 0.85; // a little over a marble, and under half the 1.73 between neighboring holes
const SYMBOL_SIZE = 0.9;

type BoardProps = {
  gameState: PublicGameState;
  viewer: Seat | null; // the board turns so this seat's start point is at the bottom
  dimmed: boolean;
  path: Hole[]; // the picked marble, then the landings chosen so far
  movable: Hole[]; // marbles that can start a move
  targets: Hole[]; // holes the marble can land on next
  onHoleClick: (hole: Hole) => void;
};

const onKey = (action: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

export default function Board({ gameState, viewer, dimmed, path, movable, targets, onHoleClick }: BoardProps) {
  const { holes, points, lastMove } = gameState;
  const turns = turnsFor(points, viewer);
  const at = (hole: Hole) => holeXY(hole, turns);
  const line = (onLine: Hole[]) => onLine.map(hole => { const { x, y } = at(hole); return `${x},${y}`; }).join(' ');

  // A start point is filled with its owner's color, and the viewer's own target is ringed in theirs (--viewer)
  const seats = Object.keys(points).map(Number) as Seat[];
  const viewerPoint = viewer === null ? undefined : points[viewer];
  function tintOf(point: PointIndex | null): string {
    if (point === null) return '';
    const owner = seats.find(seat => points[seat] === point);
    const start = owner === undefined ? '' : ` start-tint player${owner}`;
    const target = viewerPoint !== undefined && opposite(viewerPoint) === point ? ' my-target' : '';
    return start + target;
  }
  const style = viewerPoint === undefined ? undefined : ({ '--viewer': `var(--player${viewer})` } as CSSProperties);

  return (
    <svg className={`board hand-only-board${dimmed ? ' dimmed' : ''}`} viewBox={VIEW_BOX} style={style} role="group" aria-label="Chinese Checkers board">
      {HOLES.map(hole => {
        const { x, y } = at(hole);
        const isTarget = includesHole(targets, hole);
        const classNames = `hole${tintOf(pointOf(hole))}${isTarget ? ' target' : ''}`;
        // Marbles let clicks through, so every click lands on a hole: the drawn hole, or the wider ring under it
        // that is as large as a marble, so the touch target does not shrink to the hole
        return (
          <g key={holeKey(hole)}>
            <circle className="hole-hit" cx={x} cy={y} r={HIT_RADIUS} onClick={() => onHoleClick(hole)} />
            <circle
              className={classNames}
              cx={x}
              cy={y}
              r={HOLE_RADIUS}
              data-hole={holeKey(hole)}
              data-anim-key={holeAnimKey(hole)}
              onClick={() => onHoleClick(hole)}
              {...(isTarget ? { role: 'button', tabIndex: 0, 'aria-label': 'Land here', onKeyDown: onKey(() => onHoleClick(hole)) } : {})}
            />
          </g>
        );
      })}
      {lastMove && <polyline className="last-move-line" points={line(lastMove.path)} />}
      {Object.entries(holes).map(([key, seat]) => {
        const hole = parseHole(key);
        const { x, y } = at(hole);
        const canMove = includesHole(movable, hole);
        const classNames = ['marble', `player${seat}`];
        if (canMove) classNames.push('movable');
        if (path.length > 0 && holeKey(path[0]) === key) classNames.push('picked');
        return (
          <g
            key={key}
            className={classNames.join(' ')}
            data-marble={key}
            aria-label={`${SEAT_COLORS[seat]} marble`}
            {...(canMove ? { role: 'button', tabIndex: 0, onKeyDown: onKey(() => onHoleClick(hole)) } : { role: 'img' })}
          >
            <circle cx={x} cy={y} r={MARBLE_RADIUS} />
            <ColorSymbol
              color={SEAT_SYMBOLS[seat]}
              className="marble-symbol"
              svgProps={{ x: x - SYMBOL_SIZE / 2, y: y - SYMBOL_SIZE / 2, width: SYMBOL_SIZE, height: SYMBOL_SIZE, style: { width: SYMBOL_SIZE, height: SYMBOL_SIZE } }}
            />
          </g>
        );
      })}
      {path.length > 1 && <polyline className="path-line" points={line(path)} />}
    </svg>
  );
}
