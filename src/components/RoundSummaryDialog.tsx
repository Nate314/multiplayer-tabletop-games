import type { ReactNode } from 'react';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type RoundSummaryDialogProps = {
  label: string;
  title: string;
  gameState: Pick<BasePublicState, 'gameStatus' | 'activePlayers' | 'disconnected' | 'playerNames'>;
  result?: ReactNode; // the line under the title; defaults to the game status, null leaves it out
  acknowledged: Seat[];
  listDisconnected?: boolean; // Azul's waiting line also names disconnected players
  playerNumber: Seat;
  onContinue: () => void;
  children: ReactNode;
};

// The scoring between rounds: the game's own rows as children, then Continue.
// Everyone connected clicks Continue to start the next round; the last round's scoring is on the game-over screen.
export default function RoundSummaryDialog({
  label, title, gameState, result = gameState.gameStatus, acknowledged, listDisconnected = false, playerNumber, onContinue, children
}: RoundSummaryDialogProps) {
  const { playerNames, activePlayers, disconnected } = gameState;
  const waitingFor = activePlayers
    .filter(seat => !acknowledged.includes(seat) && (listDisconnected || !disconnected.includes(seat)))
    .map(seat => playerNames[seat]);

  return (
    <div className="overlay summary-overlay">
      <div className="modal round-summary" role="dialog" aria-label={label}>
        <h2>{title}</h2>
        {result !== null && <div className="summary-result">{result}</div>}
        {children}
        {acknowledged.includes(playerNumber) ? (
          <div className="summary-waiting">Waiting for {waitingFor.join(', ')}</div>
        ) : (
          <button type="button" className="primary-button" onClick={onContinue}>Continue</button>
        )}
      </div>
    </div>
  );
}
