import { bankOf } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  error: string | null;
};

function turnMessage({ currentPlayer, playerNames, activePlayers, started, isGameOver }: PublicGameState, playerNumber: Seat): string {
  const currentName = currentPlayer == null ? '' : playerNames[currentPlayer];
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for one more player';
  if (!started) return `${currentName} moves first. Joining closes after the first move.`;
  return currentPlayer === playerNumber ? 'Your turn' : `${currentName}'s turn`;
}

export default function GameStatus({ gameState, playerNumber, error }: GameStatusProps) {
  const { playerNames, board, gameStatus } = gameState;
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
      <div>
        Banks:{' '}
        {seats.map((seat, index) => (
          <span key={seat}>
            {index > 0 && ' · '}
            {playerNames[seat]} {board[bankOf(seat)].length}
          </span>
        ))}
      </div>
    </>
  );
}
