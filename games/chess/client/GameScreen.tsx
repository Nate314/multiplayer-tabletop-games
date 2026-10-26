import { useRef } from 'react';
import gameService from '../../../src/services/gameService';
import Board from './Board';
import GameStatus from './GameStatus';
import UndoVote from '../../../src/components/UndoVote';
import DrawAndResign from '../../../src/components/DrawAndResign';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import { claimableDraw } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Action, PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const claim = isMyTurn ? claimableDraw(gameState) : null;

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardAreaRef, gameState, animateMove);

  return (
    <>
      <div className="game-id hand-only-hide">Game ID: {gameState.gameId}</div>
      <div className="game-layout">
        <div className="board-area" ref={boardAreaRef}>
          <Board gameState={gameState} playerNumber={playerNumber} isMyTurn={isMyTurn} onMove={(move) => gameService.makeMove(move)} />
          <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
        </div>
        <div className="side-panel">
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
          <DrawAndResign gameState={gameState} playerNumber={playerNumber} onAction={(action) => gameService.sendAction(action)}>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
              Undo
            </button>
            {claim && (
              <button type="button" title={`Claim a draw by ${claim}`} onClick={() => gameService.sendAction({ type: 'claimDraw' } satisfies Action)}>
                Claim draw
              </button>
            )}
          </DrawAndResign>
        </div>
      </div>
    </>
  );
}
