import { isPlayablePit, opponentOf, pitsOf, storeOf } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type BoardProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  isMyTurn: boolean;
  onSow: (pit: number) => void;
};

// The viewer's row runs along the bottom, left to right, into their store on the right; the history shows seat 1's view
export default function Board({ gameState, playerNumber, isMyTurn, onSow }: BoardProps) {
  const { board, lastMove, playerNames, isGameOver } = gameState;
  const bottomSeat = playerNumber === 2 ? 2 : 1;
  const topSeat = opponentOf(bottomSeat);

  function holeClassName(hole: number, base: string): string {
    const classNames = [base];
    if (lastMove?.pit === hole) classNames.push('last-move-from');
    if (lastMove?.end === hole) classNames.push('last-move-to');
    return classNames.join(' ');
  }

  function renderPit(pit: number, row: 'top' | 'bottom') {
    const playable = isMyTurn && isPlayablePit(board, playerNumber, pit);
    return (
      <button
        key={pit}
        type="button"
        className={`${holeClassName(pit, `pit pit-${row}`)}${playable ? ' playable' : ''}`}
        disabled={!playable}
        aria-label={`${board[pit]} seeds`}
        onClick={() => onSow(pit)}
      >
        {board[pit]}
      </button>
    );
  }

  function renderStore(seat: Seat, side: 'left' | 'right') {
    const store = storeOf(seat);
    return (
      <div className={holeClassName(store, `store store-${side}`)} aria-label={`${playerNames[seat] ?? 'Empty'} store, ${board[store]} seeds`}>
        {board[store]}
      </div>
    );
  }

  return (
    <div className="board-wrap">
      <div className="row-label">{playerNames[topSeat] ?? 'Waiting for a player'}</div>
      <div className={`board ${isMyTurn ? '' : 'not-your-turn'} ${isGameOver ? 'game-over' : ''}`}>
        {renderStore(topSeat, 'left')}
        {[...pitsOf(topSeat)].reverse().map(pit => renderPit(pit, 'top'))}
        {pitsOf(bottomSeat).map(pit => renderPit(pit, 'bottom'))}
        {renderStore(bottomSeat, 'right')}
      </div>
      <div className="row-label">
        {playerNames[bottomSeat] ?? 'Waiting for a player'}{bottomSeat === playerNumber && ' (you)'}
      </div>
    </div>
  );
}
