import { useCallback, useEffect, useRef, useState } from 'react';
import gameService from '../../../src/services/gameService';
import UndoVote from '../../../src/components/UndoVote';
import { useMoveAnimation } from '../../../src/animation/useMoveAnimation.ts';
import animateMove from './animateMove.ts';
import Table from './Table';
import type { GameScreenProps } from '../../../src/clientGames.ts';
import type { PublicGameState, Seat } from '../types.ts';

// Auto-flip turns up your card this long after your turn comes up
export const AUTO_FLIP_MS = 1000;

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { currentPlayer, playerNames, activePlayers, started, isGameOver, winners, battle, pileCounts } = state;
  if (isGameOver) return winners.length > 0 ? `Game over: ${playerNames[winners[0]]} wins` : 'Game over';
  if (activePlayers.length < 2) return 'Waiting for one more player';
  const mine = currentPlayer === playerNumber;
  const name = currentPlayer === null ? '' : playerNames[currentPlayer];
  if (!started) return `${mine ? 'You flip' : `${name} flips`} first. Joining closes after the first flip.`;
  if (!mine) return `${name}'s turn`;
  if (!battle || battle.wars === 0) return 'Your turn: flip';
  return pileCounts[playerNumber] === 0
    ? 'Your turn: you have no cards left, so your last card stands. Click Flip'
    : 'Your turn: put in your war cards';
}

export default function GameScreen({ gameState, playerNumber, error }: GameScreenProps<PublicGameState>) {
  // Kept only in this browser and off on every page load
  const [autoFlip, setAutoFlip] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const { currentPlayer, activePlayers, playerNames, isGameOver, undoVote, dismissVote, undoAvailable, gameStatus, moveCount } = gameState;
  const isMyTurn = currentPlayer === playerNumber && activePlayers.length >= 2 && !isGameOver && !undoVote && !dismissVote;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  // The moveCount a flip was last sent at, so a click and the Auto-flip timer never both flip from the same state
  const sentAt = useRef<number | null>(null);
  const flip = useCallback(() => {
    if (sentAt.current === moveCount) return;
    sentAt.current = moveCount;
    gameService.makeMove({ type: 'flip' });
  }, [moveCount]);

  useMoveAnimation(screenRef, gameState, animateMove);

  // A new state (a flip, an undo), a refused flip or a vote lets the player flip again
  useEffect(() => {
    sentAt.current = null;
  }, [moveCount, error, undoVote, dismissVote]);

  // moveCount restarts the timer when the same player flips twice in a row (they start the next battle)
  useEffect(() => {
    if (!autoFlip || !isMyTurn) return;
    const timer = setTimeout(flip, AUTO_FLIP_MS);
    return () => clearTimeout(timer);
  }, [autoFlip, isMyTurn, flip]);

  return (
    <>
      <div className="game-screen" ref={screenRef}>
        <div className="game-info">
          <div className="player-info">You are {playerNames[playerNumber]} (Player {playerNumber})</div>
          {(error || gameStatus) && (
            <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
          )}
          <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
          <div className="action-buttons">
            <button type="button" className="flip-button" onClick={flip} disabled={!isMyTurn}>Flip</button>
            <label className="auto-flip">
              <input type="checkbox" checked={autoFlip} onChange={event => setAutoFlip(event.target.checked)} />
              Auto-flip
            </label>
            <button type="button" onClick={() => gameService.requestUndo()} disabled={!canUndo}>Undo</button>
          </div>
        </div>
        <Table gameState={gameState} viewer={playerNumber} onFlip={isMyTurn ? flip : undefined} />
      </div>
      <UndoVote gameState={gameState} playerNumber={playerNumber} onVote={(approve) => gameService.voteUndo(approve)} />
    </>
  );
}
