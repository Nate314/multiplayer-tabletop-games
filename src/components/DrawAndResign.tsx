import { useState, type ReactNode } from 'react';
import type { DrawOfferState, EndingAction } from '../../shared/drawOffer.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type DrawAndResignProps = {
  gameState: BasePublicState & DrawOfferState;
  playerNumber: Seat;
  onAction: (action: EndingAction) => void;
  children?: ReactNode; // the game's own buttons, shown first in the row
};

// Resigning and draw offers for two-player games (shared/drawOffer.ts), open to both players while the game runs
export default function DrawAndResign({ gameState, playerNumber, onAction, children }: DrawAndResignProps) {
  // The move count when Resign was first clicked, so the confirmation lapses once anyone moves
  const [resignAskedAt, setResignAskedAt] = useState<number | null>(null);
  const { started, isGameOver, undoVote, dismissVote, activePlayers, drawOffer, playerNames, moveCount } = gameState;
  const canAct = started && !isGameOver && !undoVote && !dismissVote && activePlayers.includes(playerNumber);
  // The opponent whose offer waits for this player's answer
  const offerer = canAct && drawOffer !== null && drawOffer !== playerNumber ? drawOffer : null;
  const confirmingResign = canAct && resignAskedAt === moveCount;

  return (
    <div className="ending-controls">
      {offerer !== null && (
        <div className="draw-offer">
          <div className="draw-offer-title">{playerNames[offerer]} offers a draw</div>
          <div className="draw-offer-actions">
            <button type="button" onClick={() => onAction({ type: 'answerDraw', accept: true })}>Accept draw</button>
            <button type="button" onClick={() => onAction({ type: 'answerDraw', accept: false })}>Decline</button>
          </div>
        </div>
      )}
      <div className="ending-buttons">
        {children}
        {confirmingResign ? (
          <>
            <button type="button" className="danger" onClick={() => onAction({ type: 'resign' })}>Confirm resign</button>
            <button type="button" onClick={() => setResignAskedAt(null)}>Keep playing</button>
          </>
        ) : (
          <>
            {offerer === null && (
              <button type="button" onClick={() => onAction({ type: 'offerDraw' })} disabled={!canAct || drawOffer === playerNumber}>
                {canAct && drawOffer === playerNumber ? 'Draw offered' : 'Offer draw'}
              </button>
            )}
            <button type="button" onClick={() => setResignAskedAt(moveCount)} disabled={!canAct}>Resign</button>
          </>
        )}
      </div>
    </div>
  );
}
