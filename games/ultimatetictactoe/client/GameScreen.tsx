import { useRef } from 'react';
import gameService from '../../../src/services/gameService';
import BigBoard from './BigBoard';
import GameStatus from '../../tictactoe/client/GameStatus';
import UndoVote from '../../../src/components/UndoVote';
import DrawAndResign from '../../../src/components/DrawAndResign';
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
    <div className="game-layout">
      <div className="board-area" ref={boardAreaRef}>
        <div className={`board hand-only-board${!isMyTurn && !isGameOver ? ' dimmed' : ''}`}>
          <BigBoard gameState={gameState} playable={isMyTurn} onPlace={(board, cell) => gameService.makeMove({ type: 'place', board, cell })} />
        </div>
        <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
      </div>
      <div className="side-panel">
        <GameStatus gameState={gameState} playerNumber={playerNumber} error={error} />
        {isMyTurn && <div className="hint">Click an empty cell in a highlighted board to place your mark</div>}
        <DrawAndResign gameState={gameState} playerNumber={playerNumber} onAction={(action) => gameService.sendAction(action)}>
          <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
            Undo
          </button>
        </DrawAndResign>
      </div>
    </div>
  );
}
