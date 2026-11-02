import type { PublicGameState } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  error: string | null;
};

function turnMessage({ currentPlayer, playerNames, activePlayers, started, isGameOver, phase }: PublicGameState): string {
  if (isGameOver) return 'Game Over';
  if (activePlayers.length < 2 || currentPlayer == null) return 'Waiting for an opponent';
  if (phase === 'marking') return 'Marking dead stones';
  const name = playerNames[currentPlayer];
  if (!started) return `${name} plays black and moves first. Joining closes after the first move.`;
  return `${name}'s turn`;
}

export default function GameStatus({ gameState, error }: GameStatusProps) {
  const { gameStatus } = gameState;
  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div>{turnMessage(gameState)}</div>
    </>
  );
}
