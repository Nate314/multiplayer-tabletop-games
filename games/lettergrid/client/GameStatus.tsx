import { useCountdown, formatClock } from '../../../src/hooks/useCountdown.ts';
import useTimerWarning from '../../../src/sound/useTimerWarning.ts';
import { deadline } from '../rules.ts';
import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  error: string | null;
};

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver } = state;
  const currentName = currentPlayer === null ? '' : playerNames[currentPlayer];
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  if (!started) return `${currentName} goes first. Joining closes after the first move.`;
  return currentPlayer === playerNumber ? 'Your turn' : `${currentName}'s turn`;
}

export default function GameStatus({ gameState, playerNumber, error }: GameStatusProps) {
  const { gameStatus, currentPlayer, isGameOver } = gameState;
  const timeLeft = useCountdown(deadline(gameState), gameState.serverTime);
  useTimerWarning(timeLeft, currentPlayer === playerNumber && !isGameOver);

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
      {timeLeft !== null && (
        <div className="turn-timer" role="timer" aria-label="Time left this turn">{formatClock(timeLeft)}</div>
      )}
    </>
  );
}
