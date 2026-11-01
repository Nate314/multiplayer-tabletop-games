import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import Board from './Board';
import DiceTray from './DiceTray';
import GameStatus from './GameStatus';
import PlayerList from './PlayerList';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState } from '../types.ts';

// A selection belongs to the move it was made after, so any new move or undo clears it
type Selection = { pawn: number; moveCount: number };

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, moveCount } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const selectedPawn = isMyTurn && selection?.moveCount === moveCount ? selection.pawn : null;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardAreaRef, gameState, animateMove);

  function handleSelect(pawn: number | null) {
    setSelection(pawn === null ? null : { pawn, moveCount });
  }

  function handleMove(move: Move) {
    gameService.makeMove(move);
    setSelection(null);
  }

  return (
    <>
      <div className="game-layout">
        <div className="board-area" ref={boardAreaRef}>
          <Board
            gameState={gameState}
            playerNumber={playerNumber}
            isMyTurn={isMyTurn}
            selectedPawn={selectedPawn}
            onSelectPawn={handleSelect}
            onMove={handleMove}
          />
          <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
        </div>
        <div className="side-panel">
          <GameStatus gameState={gameState} isMyTurn={isMyTurn} error={error} />
          <DiceTray gameState={gameState} />
          <button type="button" className="undo-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
            Undo
          </button>
          <PlayerList gameState={gameState} playerNumber={playerNumber} />
        </div>
      </div>
    </>
  );
}
