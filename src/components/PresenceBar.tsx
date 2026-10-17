import type { BasePublicState, Seat } from '../../shared/types.ts';

type PresenceBarProps = {
  gameState: BasePublicState;
  onDismiss: (seat: Seat) => void;
};

// Lists held seats, each with a way to start a dismiss vote; hidden while everyone is connected
export default function PresenceBar({ gameState, onDismiss }: PresenceBarProps) {
  const { disconnected, playerNames, currentPlayer, isGameOver, undoVote, dismissVote } = gameState;
  if (disconnected.length === 0) return null;

  const voteOpen = undoVote !== null || dismissVote !== null;
  const waitingFor = !isGameOver && currentPlayer !== null && disconnected.includes(currentPlayer) ? currentPlayer : null;

  return (
    <div className="presence-bar">
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
      {waitingFor !== null && (
        <div className="presence-waiting">{`Waiting for ${playerNames[waitingFor]} to reconnect`}</div>
      )}
    </div>
  );
}
