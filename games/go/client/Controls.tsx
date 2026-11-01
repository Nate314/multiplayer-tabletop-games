import { useState } from 'react';
import { waitingOn } from '../rules.ts';
import type { Action, PublicGameState, Seat } from '../types.ts';

type ControlsProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  isMyTurn: boolean;
  onPass: () => void;
  onAction: (action: Action) => void;
  onUndo: () => void;
};

// Pass and resign while playing; agree, resume and resign while marking dead stones.
// Uses the classes of src/components/DrawAndResign.tsx, which Go cannot use because it always offers a draw.
export default function Controls({ gameState, playerNumber, isMyTurn, onPass, onAction, onUndo }: ControlsProps) {
  // The move count when Resign was first clicked, so the confirmation lapses once anyone moves
  const [resignAskedAt, setResignAskedAt] = useState<number | null>(null);
  const { started, isGameOver, undoVote, dismissVote, undoAvailable, activePlayers, playerNames, moveCount, phase, agreed } = gameState;
  const canAct = started && !isGameOver && !undoVote && !dismissVote && activePlayers.includes(playerNumber);
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;
  const confirmingResign = canAct && resignAskedAt === moveCount;
  const marking = phase === 'marking' && !isGameOver;
  const hasAgreed = agreed.includes(playerNumber);
  const waiting = marking ? waitingOn(gameState) : [];

  return (
    <div className="ending-controls">
      {waiting.length > 0 && (
        <div className="go-waiting">Waiting for {waiting.map(seat => playerNames[seat]).join(' and ')} to agree</div>
      )}
      <div className="ending-buttons">
        <button type="button" onClick={onUndo} disabled={!canUndo}>Undo</button>
        {marking ? (
          <>
            <button type="button" aria-pressed={hasAgreed} onClick={() => onAction({ type: 'agree' })} disabled={!canAct || hasAgreed}>
              {hasAgreed ? 'Agreed' : 'Agree'}
            </button>
            <button type="button" onClick={() => onAction({ type: 'resume' })} disabled={!canAct}>Resume play</button>
          </>
        ) : (
          <button type="button" onClick={onPass} disabled={!isMyTurn}>Pass</button>
        )}
        {confirmingResign ? (
          <>
            <button type="button" className="danger" onClick={() => onAction({ type: 'resign' })}>Confirm resign</button>
            <button type="button" onClick={() => setResignAskedAt(null)}>Keep playing</button>
          </>
        ) : (
          <button type="button" onClick={() => setResignAskedAt(moveCount)} disabled={!canAct}>Resign</button>
        )}
      </div>
    </div>
  );
}
