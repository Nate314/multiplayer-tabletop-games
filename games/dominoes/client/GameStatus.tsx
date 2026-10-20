import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  error: string | null;
  hint: string | null;
};

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver, winners, roundSummary, roundNumber } = state;
  if (isGameOver) return winners.length > 0 ? `Game over: ${playerNames[winners[0]]} wins` : 'Game over';
  if (roundSummary) return `Round ${roundNumber} is over`;
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  const currentName = currentPlayer === playerNumber ? 'You' : currentPlayer === null ? '' : playerNames[currentPlayer];
  if (!started) return `${currentName} ${currentPlayer === playerNumber ? 'go' : 'goes'} first. Joining closes after the first move.`;
  return currentPlayer === playerNumber ? 'Your turn' : `${currentName}'s turn`;
}

export default function GameStatus({ gameState, playerNumber, error, hint }: GameStatusProps) {
  const { gameStatus } = gameState;

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
      <div className="hint">{hint}</div>
    </>
  );
}
