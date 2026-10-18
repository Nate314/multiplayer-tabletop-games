import gameService from '../../../src/services/gameService';
import Board from './Board';
import GameStatus from './GameStatus';
import UndoVote from '../../../src/components/UndoVote';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const { currentPlayer, activePlayers, isGameOver, undoAvailable, undoVote, dismissVote } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  function handleSow(pit: number) {
    const move: Move = { pit };
    gameService.makeMove(move);
  }

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-layout">
        <Board gameState={gameState} playerNumber={playerNumber} isMyTurn={isMyTurn} onSow={handleSow} />
        <div className="side-panel">
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
          <button type="button" className="undo-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
            Undo
          </button>
        </div>
        <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
      </div>
    </>
  );
}
