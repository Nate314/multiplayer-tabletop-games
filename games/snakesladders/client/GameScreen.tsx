import { useRef } from 'react';
import gameService from '../../../src/services/gameService';
import Board from './Board';
import RollPanel from './RollPanel';
import GameStatus from './GameStatus';
import PlayerList from './PlayerList';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { Move, PublicGameState } from '../types.ts';

const ROLL: Move = { type: 'roll' };

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  // Only the live board animates here; the history dialog runs animateMove on its own board
  useMoveAnimation(boardAreaRef, gameState, animateMove);

  return (
    <div className="sl-layout">
      <div className="sl-board-area" ref={boardAreaRef}>
        <Board gameState={gameState} />
        <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
      </div>
      <div className="sl-side-panel">
        <GameStatus gameState={gameState} isMyTurn={isMyTurn} error={error} />
        <RollPanel gameState={gameState} canRoll={isMyTurn} onRoll={() => gameService.makeMove(ROLL)} />
        <button type="button" className="sl-button sl-undo-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
          Undo
        </button>
        <PlayerList gameState={gameState} playerNumber={playerNumber} />
      </div>
    </div>
  );
}
