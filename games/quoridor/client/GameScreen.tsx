import { useState, useEffect, useRef } from 'react';
import gameService from '../../../src/services/gameService';
import ActionButtons from './ActionButtons';
import Board from './Board';
import GameStatus from './GameStatus';
import GoalList from './GoalList';
import TurnActions from './TurnActions';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState } from '../types.ts';
import type { Action } from './types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [selectedAction, setSelectedAction] = useState<Action>('move');
  const [lastMoveHovered, setLastMoveHovered] = useState(false);
  const [lastMovePinned, setLastMovePinned] = useState(false);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, lastMove, isGameOver, undoVote } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote;
  const showLastMove = Boolean(lastMove) && (lastMoveHovered || lastMovePinned);

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardAreaRef, gameState, animateMove);

  useEffect(() => {
    // Reset to move at the start of every turn
    setSelectedAction('move');
  }, [currentPlayer]);

  function handleMove(move: Move) {
    gameService.makeMove(move);
    if (move.type === 'wall') setSelectedAction('move');
  }

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game game-layout">
        <div className="board-area" ref={boardAreaRef}>
          <Board
            gameState={gameState}
            playerNumber={playerNumber}
            isMyTurn={isMyTurn}
            selectedAction={selectedAction}
            showLastMove={showLastMove}
            onMove={handleMove}
          />
          <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
        </div>
        <div className="game-info side-panel">
          <GameStatus gameState={gameState} error={error} />
          <TurnActions selectedAction={selectedAction} onSelectAction={setSelectedAction} />
          <ActionButtons
            gameState={gameState}
            playerNumber={playerNumber}
            lastMovePinned={lastMovePinned}
            onUndo={() => gameService.requestUndo()}
            onToggleLastMovePinned={() => setLastMovePinned(prev => !prev)}
            onLastMoveHover={setLastMoveHovered}
          />
          <GoalList gameState={gameState} playerNumber={playerNumber} />
        </div>
      </div>
    </>
  );
}
