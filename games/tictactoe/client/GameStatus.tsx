import YouTag from '../../../src/components/YouTag.tsx';
import Mark from './Mark';
import { markOf } from '../marks.ts';
import type { MarkState } from '../marks.ts';
import type { BasePublicState, Seat } from '../../../shared/types.ts';

// Any game's public state with an X seat: Tic-Tac-Toe's and Ultimate Tic-Tac-Toe's
type MarkedState = BasePublicState & MarkState;

type GameStatusProps = {
  gameState: MarkedState;
  playerNumber: Seat;
  error: string | null;
};

function turnMessage(gameState: MarkedState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver } = gameState;
  if (isGameOver) return 'Game Over';
  if (activePlayers.length < 2) return 'Waiting for an opponent';
  const name = currentPlayer === playerNumber ? 'You' : playerNames[currentPlayer as Seat];
  const verb = currentPlayer === playerNumber ? 'move' : 'moves';
  if (!started) return `${name} (${markOf(gameState, currentPlayer as Seat)}) ${verb} first. Joining closes after the first move.`;
  return currentPlayer === playerNumber ? 'Your turn' : `${name}'s turn`;
}

export default function GameStatus({ gameState, playerNumber, error }: GameStatusProps) {
  const { playerNames, currentPlayer, activePlayers, gameStatus } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
      <ul className="player-list">
        {seats.map(seat => (
          <li key={seat} className={`${seat === currentPlayer ? 'current' : ''} ${activePlayers.includes(seat) ? '' : 'player-left'}`}>
            <span className="player-mark"><Mark mark={markOf(gameState, seat)} /></span>
            {playerNames[seat]}<YouTag when={seat === playerNumber} />
            {!activePlayers.includes(seat) && ' (left)'}
          </li>
        ))}
      </ul>
    </>
  );
}
