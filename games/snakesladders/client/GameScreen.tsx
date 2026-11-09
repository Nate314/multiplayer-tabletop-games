import { useCallback, useEffect, useRef, useState } from 'react';
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
export const AUTO_ROLL_MS = 1000;

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  // Kept only in this browser and off on every page load
  const [autoRoll, setAutoRoll] = useState(false);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, isGameOver, undoVote, dismissVote, undoAvailable, moveCount } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  // The moveCount a roll was last sent at, so a click and the Auto-roll timer never both roll from the same state
  const sentAt = useRef<number | null>(null);
  const roll = useCallback(() => {
    if (sentAt.current === moveCount) return;
    sentAt.current = moveCount;
    gameService.makeMove(ROLL);
  }, [moveCount]);

  // A new state (a roll, an undo), a refused roll or a vote lets the player roll again
  useEffect(() => {
    sentAt.current = null;
  }, [moveCount, error, undoVote, dismissVote]);

  // moveCount restarts the timer after a 6, when the same player rolls again
  useEffect(() => {
    if (!autoRoll || !isMyTurn) return;
    const timer = setTimeout(roll, AUTO_ROLL_MS);
    return () => clearTimeout(timer);
  }, [autoRoll, isMyTurn, roll]);

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
        <RollPanel gameState={gameState} canRoll={isMyTurn} onRoll={roll} autoRoll={autoRoll} onAutoRoll={setAutoRoll} />
        <button type="button" className="sl-button sl-undo-button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>
          Undo
        </button>
        <PlayerList gameState={gameState} playerNumber={playerNumber} />
      </div>
    </div>
  );
}
