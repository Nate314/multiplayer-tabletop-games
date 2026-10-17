import { connectedPlayers } from '../../shared/seating.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type VotePanelProps = {
  className: 'undo-vote' | 'dismiss-vote'; // prefix of every class, so games can style each vote
  title: string;
  votes: Record<Seat, boolean>;
  gameState: BasePublicState;
  playerNumber: Seat;
  onVote: (approve: boolean) => void;
};

// Only connected players vote, as the server counts them
export default function VotePanel({ className, title, votes, gameState, playerNumber, onVote }: VotePanelProps) {
  const voters = connectedPlayers(gameState);
  const canVote = voters.includes(playerNumber) && !votes[playerNumber];

  return (
    <div className={className}>
      <div className={`${className}-panel`}>
        <div className={`${className}-title`}>{title}</div>
        <ul className={`${className}-list`}>
          {voters.map(seat => (
            <li key={seat}>
              {gameState.playerNames[seat]}: {votes[seat] ? 'approved' : 'waiting'}
            </li>
          ))}
        </ul>
        {canVote ? (
          <div className={`${className}-actions`}>
            <button onClick={() => onVote(true)}>Approve</button>
            <button onClick={() => onVote(false)}>Decline</button>
          </div>
        ) : (
          <div>Waiting for the other players</div>
        )}
      </div>
    </div>
  );
}
