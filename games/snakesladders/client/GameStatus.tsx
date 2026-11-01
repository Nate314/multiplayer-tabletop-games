import type { PublicGameState } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  isMyTurn: boolean;
  error: string | null;
};

function turnMessage({ currentPlayer, playerNames, activePlayers, started, isGameOver }: PublicGameState, isMyTurn: boolean): string {
  const currentName = currentPlayer == null ? '' : playerNames[currentPlayer];
  if (isGameOver) return 'Game Over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  const turn = isMyTurn ? 'Your turn: roll the die' : `${currentName}'s turn`;
  return started ? turn : `${turn}. Joining closes after the first move.`;
}

export default function GameStatus({ gameState, isMyTurn, error }: GameStatusProps) {
  const { gameStatus } = gameState;
  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'sl-status sl-status-error' : 'sl-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className={isMyTurn ? 'sl-turn sl-your-turn' : 'sl-turn'}>{turnMessage(gameState, isMyTurn)}</div>
    </>
  );
}
