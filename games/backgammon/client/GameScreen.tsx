import { useRef } from 'react';
import gameService from '../../../src/services/gameService';
import Board from './Board';
import GameStatus from './GameStatus';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardAreaRef, gameState, animateMove);

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="bg-layout">
        <div className="bg-board-area" ref={boardAreaRef}>
          <Board gameState={gameState} playerNumber={playerNumber} isMyTurn={isMyTurn} onMove={move => gameService.makeMove(move)} />
          <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
        </div>
        <div className="bg-panel">
          <GameStatus gameState={gameState} playerNumber={playerNumber} isMyTurn={isMyTurn} error={error} />
          <button type="button" className="bg-undo" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
            Undo
          </button>
        </div>
      </div>
    </>
  );
}
