import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { FINISH, LADDERS, SNAKES, cellOf } from '../board.ts';
import { tokenKey } from './animateMove.ts';
import { SEAT_SYMBOLS } from './seatSymbols.ts';
import { centerOf, stackOffset } from './geometry.ts';
import type { PublicGameState, Seat } from '../types.ts';

type Point = { x: number; y: number };

const SQUARES = Array.from({ length: FINISH }, (_, index) => index + 1);
const RAIL_GAP = 1.8; // half the ladder's width
const RUNG_SPACING = 3.5;
const SNAKE_WAVE = 12; // board units per bend of a snake's body
const SNAKE_SWAY = 2.5;
const TOKEN_RADIUS = 2.8; // alone on a square
const STACKED_RADIUS = 1.45; // sharing one, so six fit apart inside the cell

// The length from a to b, the unit vector along it and the one at right angles to it
function axes(a: Point, b: Point): { length: number; along: Point; across: Point } {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const along = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  return { length, along, across: { x: -along.y, y: along.x } };
}

const at = (p: Point, v: Point, k: number): Point => ({ x: p.x + v.x * k, y: p.y + v.y * k });

function Ladder({ from, to }: { from: number; to: number }) {
  const foot = centerOf(from);
  const top = centerOf(to);
  const { length, along, across } = axes(foot, top);
  const rungs = Math.floor(length / RUNG_SPACING);
  const rail = (side: number) => {
    const a = at(foot, across, side * RAIL_GAP);
    const b = at(top, across, side * RAIL_GAP);
    return <line className="sl-ladder-rail" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  };
  return (
    <g className="sl-ladder" data-kind="ladder" data-from={from} data-to={to}>
      {rail(-1)}
      {rail(1)}
      {Array.from({ length: rungs }, (_, index) => {
        const middle = at(foot, along, (index + 1) * (length / (rungs + 1)));
        const a = at(middle, across, -RAIL_GAP);
        const b = at(middle, across, RAIL_GAP);
        return <line key={index} className="sl-ladder-rung" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
    </g>
  );
}

function Snake({ from, to }: { from: number; to: number }) {
  const head = centerOf(from);
  const tail = centerOf(to);
  const { length, along, across } = axes(head, tail);
  const bends = Math.max(2, Math.round(length / SNAKE_WAVE));
  const step = length / bends;
  // One curve per bend, swaying to alternate sides
  const body = Array.from({ length: bends }, (_, index) => {
    const control = at(at(head, along, (index + 0.5) * step), across, (index % 2 === 0 ? 1 : -1) * SNAKE_SWAY);
    const end = at(head, along, (index + 1) * step);
    return `Q${control.x} ${control.y} ${end.x} ${end.y}`;
  }).join(' ');
  const eye = (side: number) => at(at(head, along, -0.7), across, side * 0.8);
  return (
    <g className="sl-snake" data-kind="snake" data-from={from} data-to={to}>
      <path className="sl-snake-body" d={`M${head.x} ${head.y} ${body}`} />
      <circle className="sl-snake-head" cx={head.x} cy={head.y} r={2.2} />
      {[-1, 1].map(side => <circle key={side} className="sl-snake-eye" cx={eye(side).x} cy={eye(side).y} r={0.45} />)}
    </g>
  );
}

type TokenProps = { seat: Seat; name: string; square: number; index: number; count: number };

function Token({ seat, name, square, index, count }: TokenProps) {
  const center = centerOf(square);
  const { dx, dy } = stackOffset(index, count);
  const radius = count === 1 ? TOKEN_RADIUS : STACKED_RADIUS;
  const symbol = radius * 1.2;
  // The outer group has no transform of its own, so the move animation can translate it
  return (
    <g className={`sl-token sl-seat${seat}`} data-anim-key={tokenKey(seat)} role="img" aria-label={`${name}, square ${square}`}>
      <g transform={`translate(${center.x + dx} ${center.y + dy})`}>
        <circle className="sl-token-disc" r={radius} />
        <ColorSymbol
          color={SEAT_SYMBOLS[seat]}
          className="sl-token-symbol"
          svgProps={{ x: -symbol / 2, y: -symbol / 2, width: symbol, height: symbol, style: { width: symbol, height: symbol } }}
        />
      </g>
    </g>
  );
}

// The 100 squares as a grid, with the ladders, snakes and tokens drawn over them in one SVG
export default function Board({ gameState }: { gameState: PublicGameState }) {
  const { positions, playerNames, lastMove } = gameState;
  const seats = Object.keys(positions).map(Number).sort((a, b) => a - b);
  const sharing = (square: number) => seats.filter(seat => positions[seat] === square);

  function squareClass(square: number): string {
    const { row, col } = cellOf(square);
    const classNames = ['sl-square', (row + col) % 2 === 0 ? 'sl-square-light' : 'sl-square-dark'];
    if (lastMove?.from === square) classNames.push('sl-last-from');
    if (lastMove?.to === square) classNames.push('sl-last-to');
    return classNames.join(' ');
  }

  return (
    <div className="sl-board" role="group" aria-label="Board">
      {SQUARES.map(square => {
        const { row, col } = cellOf(square);
        return (
          <div key={square} className={squareClass(square)} style={{ gridRow: row + 1, gridColumn: col + 1 }} data-square={square}>
            <span className="sl-square-number">{square}</span>
          </div>
        );
      })}
      <svg className="sl-overlay" viewBox="0 0 100 100">
        {Object.entries(LADDERS).map(([from, to]) => <Ladder key={`ladder-${from}`} from={Number(from)} to={to} />)}
        {Object.entries(SNAKES).map(([from, to]) => <Snake key={`snake-${from}`} from={Number(from)} to={to} />)}
        {seats.map(seat => {
          const there = sharing(positions[seat]);
          return <Token key={seat} seat={seat} name={playerNames[seat]} square={positions[seat]} index={there.indexOf(seat)} count={there.length} />;
        })}
      </svg>
    </div>
  );
}
