import type { BasePublicState, Seat } from '../../shared/types.ts';
import { formatTurnClock } from '../hooks/useCountdown.ts';
import useTurnTimer from '../sound/useTurnTimer.ts';

type PresenceBarProps = {
  gameState: BasePublicState;
  playerNumber: Seat | null;
  onDismiss: (seat: Seat) => void;
};

// Lists held seats, each with a way to start a dismiss vote, and shows the turn timer; hidden when neither applies
export default function PresenceBar({ gameState, playerNumber, onDismiss }: PresenceBarProps) {
  const { disconnected, playerNames, currentPlayer, isGameOver, undoVote, dismissVote } = gameState;
  const { msLeft, paused } = useTurnTimer(gameState, playerNumber);
  const timed = msLeft !== null && currentPlayer !== null && !isGameOver;
  if (disconnected.length === 0 && !timed) return null;

  const voteOpen = undoVote !== null || dismissVote !== null;
  const waitingFor = !isGameOver && currentPlayer !== null && disconnected.includes(currentPlayer) ? currentPlayer : null;

  return (
    <div className="presence-bar">
      {timed && (
        <div className="presence-timer" data-low={msLeft > 0 && msLeft <= 10_000 ? '' : undefined} data-over={msLeft <= 0 ? '' : undefined}>
          <div className="presence-timer-line">
            <span className="presence-name">{playerNames[currentPlayer]}</span>
            <span className="presence-clock">{formatTurnClock(msLeft) + (paused ? ' (paused)' : '')}</span>
          </div>
          {msLeft <= 0 && (currentPlayer === playerNumber
            ? <span role="status">Time's up</span>
            : <span>{`${playerNames[currentPlayer]} is over time`}</span>)}
        </div>
      )}
      {disconnected.length > 0 && (
        <ul className="presence-list">
          {disconnected.map(seat => (
            <li key={seat} className="presence-player">
              <span>{`${playerNames[seat]} (disconnected)`}</span>
              {/* After the game is over nothing waits on them, so there is nothing to dismiss */}
              {!isGameOver && (
                <button type="button" className="dismiss-button" disabled={voteOpen} onClick={() => onDismiss(seat)}>
                  Dismiss
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {waitingFor !== null && (
        <div className="presence-waiting">{`Waiting for ${playerNames[waitingFor]} to reconnect`}</div>
      )}
    </div>
  );
}
