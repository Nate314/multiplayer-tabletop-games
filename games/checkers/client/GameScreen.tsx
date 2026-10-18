import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import Board from './Board';
import GameStatus from './GameStatus';
import UndoVote from '../../../src/components/UndoVote';
import DrawAndResign from '../../../src/components/DrawAndResign';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import { includesPosition, isCompleteMove, nextSquares } from './selection.ts';
import { getLegalMoves, isJump, isSamePosition } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Position, PublicGameState } from '../types.ts';

// Squares picked during one turn; a pick from an earlier state is dropped
type Picked = { moveCount: number; squares: Position[] };

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const [pickedState, setPicked] = useState<Picked>({ moveCount: -1, squares: [] });
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { board, currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, moveCount } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  const picked = pickedState.moveCount === moveCount ? pickedState.squares : [];
  const legal = isMyTurn ? getLegalMoves(board, playerNumber) : [];
  const mustCapture = legal.length > 0 && isJump(legal[0]);
  const movable = nextSquares(legal, []);
  const targets = picked.length > 0 ? nextSquares(legal, picked) : [];

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardAreaRef, gameState, animateMove);

  function pick(squares: Position[]) {
    setPicked({ moveCount, squares });
  }

  // Click a piece, then each landing square; the move is sent once the last jump is picked
  function handleSquareClick(position: Position) {
    if (!isMyTurn) return;
    if (includesPosition(targets, position)) {
      const squares = [...picked, position];
      if (isCompleteMove(legal, squares)) {
        gameService.makeMove({ type: 'move', path: squares });
        pick([]);
      } else {
        pick(squares);
      }
    } else if (includesPosition(movable, position)) {
      // Clicking the chosen piece again lets it go; a piece part way through a jump starts over
      const again = picked.length === 1 && isSamePosition(picked[0], position);
      pick(again ? [] : [position]);
    } else {
      pick([]);
    }
  }

  function hint(): string {
    if (!isMyTurn) return '';
    if (picked.length > 1) return 'Keep jumping: click the next landing square';
    if (picked.length === 1) return 'Click a highlighted square to move there';
    return mustCapture ? 'You must capture: click a glowing piece' : 'Click one of your pieces';
  }

  return (
    <>
      <div className="game-id">Game ID: {gameState.gameId}</div>
      <div className="game-layout">
        <div className="board-area" ref={boardAreaRef}>
          <Board
            gameState={gameState}
            flipped={playerNumber === 2}
            dimmed={!isMyTurn}
            picked={picked}
            movable={movable}
            targets={targets}
            mustCapture={mustCapture}
            onSquareClick={handleSquareClick}
          />
          <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
        </div>
        <div className="side-panel">
          <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
          {isMyTurn && <div className="hint">{hint()}</div>}
          <DrawAndResign gameState={gameState} playerNumber={playerNumber} onAction={(action) => gameService.sendAction(action)}>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
              Undo
            </button>
          </DrawAndResign>
        </div>
      </div>
    </>
  );
}
