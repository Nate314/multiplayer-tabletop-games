import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import Board from './Board';
import GameStatus from './GameStatus';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  // The move count when Resign was first clicked, so the confirmation lapses once anyone moves
  const [resignAskedAt, setResignAskedAt] = useState<number | null>(null);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, moveCount } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const confirmingResign = isMyTurn && resignAskedAt === moveCount;

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardAreaRef, gameState, animateMove);

  function handleMove(move: Move) {
    gameService.makeMove(move);
    setResignAskedAt(null);
  }

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-layout">
        <div className="board-area" ref={boardAreaRef}>
          <Board gameState={gameState} playerNumber={playerNumber} isMyTurn={isMyTurn} onMove={handleMove} />
          <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
        </div>
        <div className="side-panel">
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
          <div className="action-buttons">
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
              Undo
            </button>
            {confirmingResign ? (
              <>
                <button type="button" className="danger" onClick={() => handleMove({ type: 'resign' })}>Confirm resign</button>
                <button type="button" onClick={() => setResignAskedAt(null)}>Keep playing</button>
              </>
            ) : (
              <button type="button" onClick={() => setResignAskedAt(moveCount)} disabled={!isMyTurn}>
                Resign
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
