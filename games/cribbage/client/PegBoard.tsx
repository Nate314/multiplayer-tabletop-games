import YouTag from '../../../src/components/YouTag.tsx';
import { teamSeats } from '../../../shared/partnerships.ts';
import { partnerships, sideName, sideOf, targetScore } from '../rules.ts';
import type { PublicGameState, Seat, Side } from '../types.ts';

const PER_ROW = 30;
const GROUP = 5;
const STEP = 10;
const GROUP_GAP = 6;
const LANE = 9;
const ROW_GAP = 10;
const X0 = 26; // the first hole; the two start holes sit left of it
const ROW_WIDTH = (PER_ROW - 1) * STEP + (PER_ROW / GROUP - 1) * GROUP_GAP;
const GAME_X = X0 + ROW_WIDTH + 18;

// The track: holes 1 to target - 1 in rows of 30, one lane per side, then the game hole
export default function PegBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { scores, pegs, winners } = gameState;
  const target = targetScore(gameState);
  const sides = Object.keys(scores).map(Number);
  const rows = Math.ceil((target - 1) / PER_ROW);
  const rowHeight = sides.length * LANE + ROW_GAP;
  const height = rows * rowHeight;
  const colorSeat = (side: Side): Seat => (partnerships(gameState) ? teamSeats(side === 0 ? 0 : 1)[0] : side);
  const color = (side: Side) => `var(--seat-color-${colorSeat(side)})`;
  const holeAt = (point: number, lane: number) => {
    const row = Math.floor((point - 1) / PER_ROW);
    const col = (point - 1) % PER_ROW;
    return { x: X0 + col * STEP + Math.floor(col / GROUP) * GROUP_GAP, y: row * rowHeight + ROW_GAP / 2 + lane * LANE + LANE / 2 };
  };
  // 0 is a start hole, the target and past it the game hole
  const pegAt = (point: number, lane: number, back: boolean) => {
    if (point >= target) return { x: GAME_X, y: height / 2 };
    if (point <= 0) return { x: back ? 6 : 15, y: ROW_GAP / 2 + lane * LANE + LANE / 2 };
    return holeAt(point, lane);
  };
  const holes = sides.flatMap((_, lane) => Array.from({ length: target - 1 }, (__, i) => ({ ...holeAt(i + 1, lane), key: `${lane}-${i}` })));
  const mine = viewer !== null && gameState.playerNames[viewer] !== undefined ? sideOf(gameState, viewer) : null;

  return (
    <section className="peg-board" aria-label="Peg board">
      <ul className="peg-scores" aria-label="Scores">
        {sides.map(side => (
          <li key={side} className={winners.some(seat => sideOf(gameState, seat) === side) ? 'peg-score peg-score-winner' : 'peg-score'}>
            <span className="peg-swatch" style={{ background: color(side) }} />
            <span className="peg-name">{sideName(gameState, side)}<YouTag when={side === mine} /></span>
            <span className="peg-points">{scores[side]}</span>
          </li>
        ))}
        <li className="peg-target">Game: {target}</li>
      </ul>
      <div className="peg-track">
        <svg viewBox={`0 0 ${GAME_X + 10} ${height}`} role="img" aria-label={sides.map(side => `${sideName(gameState, side)} ${scores[side]}`).join(', ')}>
          {holes.map(({ x, y, key }) => <circle key={key} className="peg-hole" cx={x} cy={y} r={1.6} />)}
          <circle className="peg-hole" cx={GAME_X} cy={height / 2} r={3} />
          {sides.map((side, lane) => [true, false].map(back => {
            const { x, y } = pegAt(back ? pegs[side]?.back ?? 0 : pegs[side]?.front ?? 0, lane, back);
            return <circle key={`${side}-${back}`} className={back ? 'peg peg-back' : 'peg'} cx={x} cy={y} r={3.4} fill={color(side)} />;
          }))}
        </svg>
      </div>
    </section>
  );
}
