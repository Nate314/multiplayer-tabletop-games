import { bankOf, isPlayablePit, opponentOf, pitsOf, rulesOf, stoneCount } from '../rules.ts';
import { holeKey, stoneKey } from './animateMove.ts';
import { drawnCount, stoneSpot } from './stoneLayout.ts';
import type { PublicGameState, Seat } from '../types.ts';

type BoardProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  isMyTurn: boolean;
  onPlay: (pit: number) => void;
};

// Arrowheads on the loop around the board, pointing the way the stones travel: counter-clockwise
const ARROWS = ['top-left', 'top-right', 'right', 'bottom-left', 'bottom-right', 'left'];

// The viewer's row runs along the bottom, left to right, into their bank on the right; the history shows seat 1's view
export default function Board({ gameState, playerNumber, isMyTurn, onPlay }: BoardProps) {
  const { board, lastMove, playerNames, isGameOver } = gameState;
  const { otherSide } = rulesOf(gameState);
  const bottomSeat = playerNumber === 2 ? 2 : 1;
  const topSeat = opponentOf(bottomSeat);

  function bankName(seat: Seat): string {
    if (seat === playerNumber) return 'Your bank';
    return playerNames[seat] ? `${playerNames[seat]}'s bank` : 'Bank';
  }

  function holeClassName(hole: number, base: string): string {
    const classNames = [base];
    if (lastMove?.pit === hole) classNames.push('last-move-from');
    if (lastMove?.end === hole) classNames.push('last-move-to');
    return classNames.join(' ');
  }

  function renderStones(hole: number) {
    const stones = board[hole];
    const drawn = drawnCount(hole, stones.length);
    return (
      <>
        {stones.slice(0, drawn).map((stone, index) => {
          const { x, y, size } = stoneSpot(hole, index, stones.length);
          return (
            <span
              key={index}
              className={`stone seat-${stone}`}
              data-anim-key={stoneKey(hole, index)}
              style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${size * 100}%`, margin: `${-size * 50}%` }}
            />
          );
        })}
        <span className="count">{stones.length}</span>
      </>
    );
  }

  function renderPit(pit: number, row: 'top' | 'bottom') {
    const playable = isMyTurn && isPlayablePit(board, playerNumber, pit, otherSide);
    return (
      <button
        key={pit}
        type="button"
        className={`${holeClassName(pit, `pit pit-${row}`)}${playable ? ' playable' : ''}`}
        data-anim-key={holeKey(pit)}
        disabled={!playable}
        aria-label={stoneCount(board[pit].length)}
        onClick={() => onPlay(pit)}
      >
        {renderStones(pit)}
      </button>
    );
  }

  function renderBank(seat: Seat, side: 'left' | 'right') {
    const bank = bankOf(seat);
    return (
      <div
        className={holeClassName(bank, `bank bank-${side} seat-${seat}`)}
        data-anim-key={holeKey(bank)}
        aria-label={`${bankName(seat)}, ${stoneCount(board[bank].length)}`}
      >
        {renderStones(bank)}
      </div>
    );
  }

  return (
    <div className="board-wrap">
      <div className="board-caption">
        <span className={`bank-label bank-label-left seat-${topSeat}`}>{bankName(topSeat)}</span>
        <span className="row-label">{playerNames[topSeat] ?? 'Waiting for a player'}</span>
      </div>
      <div className="board-loop" title="Stones move counter-clockwise">
        {ARROWS.map(place => <span key={place} className={`arrow arrow-${place}`} aria-hidden="true" />)}
        <div className={`board ${isMyTurn ? '' : 'not-your-turn'} ${isGameOver ? 'game-over' : ''}`}>
          {renderBank(topSeat, 'left')}
          {[...pitsOf(topSeat)].reverse().map(pit => renderPit(pit, 'top'))}
          {pitsOf(bottomSeat).map(pit => renderPit(pit, 'bottom'))}
          {renderBank(bottomSeat, 'right')}
        </div>
      </div>
      <div className="board-caption">
        <span className="row-label">
          {playerNames[bottomSeat] ?? 'Waiting for a player'}{bottomSeat === playerNumber && ' (you)'}
        </span>
        <span className={`bank-label bank-label-right seat-${bottomSeat}`}>{bankName(bottomSeat)}</span>
      </div>
    </div>
  );
}
