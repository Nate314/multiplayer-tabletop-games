import { useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import Board from './Board';
import Controls from './Controls';
import GameStatus from './GameStatus';
import ScorePanel from './ScorePanel';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import { applyMove, colorOf } from '../rules.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Action, Move, Point, PublicGameState } from '../types.ts';

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const boardAreaRef = useRef<HTMLDivElement>(null);
  // A point refused here without asking the server, kept with the move count so the next move clears it
  const [refusal, setRefusal] = useState<{ text: string; moveCount: number } | null>(null);
  const { board, currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, phase, moveCount } = gameState;
  const busy = isGameOver || !!undoVote || !!dismissVote || activePlayers.length < 2 || !activePlayers.includes(playerNumber);
  const isMyTurn = !busy && phase === 'play' && currentPlayer === playerNumber;
  const canMark = !busy && phase === 'marking';
  const localError = refusal?.moveCount === moveCount ? refusal.text : null;

  // Only the live board animates; the history dialog's board renders without this hook
  useMoveAnimation(boardAreaRef, gameState, animateMove);

  // The server's own check (rules.ts): a taken point, suicide or ko
  function placeRefusal(point: Point): string | null {
    const result = applyMove(gameState, playerNumber, { type: 'place', ...point } satisfies Move);
    return 'error' in result ? result.error : null;
  }

  function handlePoint(point: Point) {
    if (canMark) {
      if (board[point.row][point.col]) gameService.sendAction({ type: 'mark', ...point } satisfies Action);
      return;
    }
    const text = placeRefusal(point);
    setRefusal(text ? { text, moveCount } : null);
    if (!text) gameService.makeMove({ type: 'place', ...point } satisfies Move);
  }

  return (
    <div className="game-layout">
      <div className="board-area" ref={boardAreaRef}>
        <Board
          gameState={gameState}
          ghost={isMyTurn ? colorOf(playerNumber) : null}
          isLegal={point => placeRefusal(point) === null}
          onPoint={isMyTurn || canMark ? handlePoint : undefined}
        />
        <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
      </div>
      <div className="side-panel">
        <GameStatus gameState={gameState} error={localError ?? error} />
        <Controls
          gameState={gameState}
          playerNumber={playerNumber}
          isMyTurn={isMyTurn}
          onPass={() => gameService.makeMove({ type: 'pass' } satisfies Move)}
          onAction={(action) => gameService.sendAction(action)}
          onUndo={() => gameService.requestUndo()}
        />
        <ScorePanel gameState={gameState} viewer={playerNumber} />
      </div>
    </div>
  );
}
