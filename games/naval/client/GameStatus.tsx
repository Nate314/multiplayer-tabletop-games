import YouTag from '../../../src/components/YouTag.tsx';
import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  error: string | null;
};

const SEATS: Seat[] = [1, 2];

export default function GameStatus({ gameState, playerNumber, error }: GameStatusProps) {
  const { gameStatus, playerNames, activePlayers, currentPlayer, isGameOver, phase } = gameState;

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      {activePlayers.length < 2 && !isGameOver && <div>Waiting for another player</div>}
      <ul className="player-list">
        {SEATS.filter(seat => playerNames[seat]).map(seat => {
          const classNames = ['player-row'];
          if (seat === currentPlayer && phase === 'firing' && !isGameOver) classNames.push('to-move');
          if (!activePlayers.includes(seat)) classNames.push('player-left');
          return (
            <li key={seat} className={classNames.join(' ')}>
              {playerNames[seat]}<YouTag when={seat === playerNumber} />
              {!activePlayers.includes(seat) && ' (left)'}
            </li>
          );
        })}
      </ul>
    </>
  );
}
