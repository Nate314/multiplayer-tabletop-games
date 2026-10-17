import type { Seat, DismissVote as DismissVoteState } from '../../shared/types.ts';

type DismissVoteProps = {
  vote: DismissVoteState;
  playerNumber: Seat;
  connectedPlayers: Seat[]; // only connected players vote
  playerNames: Record<Seat, string>;
  onVote: (approve: boolean) => void;
};

export default function DismissVote({ vote, playerNumber, connectedPlayers, playerNames, onVote }: DismissVoteProps) {
  const canVote = connectedPlayers.includes(playerNumber) && !vote.votes[playerNumber];

  return (
    <div className="dismiss-vote">
      <div className="dismiss-vote-panel">
        <div className="dismiss-vote-title">
          {`${playerNames[vote.requestedBy]} wants to dismiss ${playerNames[vote.target]}`}
        </div>
        <ul className="dismiss-vote-list">
          {connectedPlayers.map(seat => (
            <li key={seat}>
              {playerNames[seat]}: {vote.votes[seat] ? 'approved' : 'waiting'}
            </li>
          ))}
        </ul>
        {canVote ? (
          <div className="dismiss-vote-actions">
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
