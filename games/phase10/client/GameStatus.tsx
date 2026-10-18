import type { PublicGameState } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  error: string | null;
  hint: string | null;
};

function turnMessage(state: PublicGameState): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver, handNumber, handSummary, tiebreak } = state;
  const currentName = currentPlayer === null ? '' : playerNames[currentPlayer];
  if (isGameOver) return 'Game over';
  if (handSummary) return `Hand ${handNumber} is over`;
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  if (!started) return `${currentName} goes first. Joining closes after the first move.`;
  return `${tiebreak.length > 0 ? 'Tiebreaker hand' : 'Hand'} ${handNumber}: ${currentName}'s turn`;
}

export default function GameStatus({ gameState, error, hint }: GameStatusProps) {
  const { gameStatus } = gameState;

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className="turn-message">{turnMessage(gameState)}</div>
      <div className="hint">{hint}</div>
    </>
  );
}
