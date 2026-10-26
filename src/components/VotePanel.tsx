import { connectedPlayers } from '../../shared/seating.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type VotePanelProps = {
  className: 'undo-vote' | 'dismiss-vote' | 'rematch-vote'; // prefix of every class, so games can style each vote
  title: string;
  votes: Record<Seat, boolean>;
  gameState: BasePublicState;
  playerNumber: Seat | null; // null for a spectator, who only reads the list
  onVote: (approve: boolean) => void;
  voters?: Seat[];
  yesLabel?: string;
  noLabel?: string;
  answer?: (seat: Seat) => string;
  onRemove?: (seat: Seat) => void; // shown beside each seat still waiting, other than the viewer's
};

const approvedOrWaiting = (votes: Record<Seat, boolean>) => (seat: Seat) => votes[seat] ? 'approved' : 'waiting';

// Only connected players vote by default, as the server counts them
export default function VotePanel({
  className, title, votes, gameState, playerNumber, onVote,
  voters = connectedPlayers(gameState), yesLabel = 'Approve', noLabel = 'Decline', answer = approvedOrWaiting(votes), onRemove
}: VotePanelProps) {
  const canVote = playerNumber !== null && voters.includes(playerNumber) && votes[playerNumber] === undefined;

  return (
    <div className={className}>
      <div className={`${className}-panel`}>
        <div className={`${className}-title`}>{title}</div>
        <ul className={`${className}-list`}>
          {voters.map(seat => (
            <li key={seat}>
              {gameState.playerNames[seat]}: {answer(seat)}
              {onRemove && votes[seat] === undefined && seat !== playerNumber && (
                <button type="button" onClick={() => onRemove(seat)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
        {canVote ? (
          <div className={`${className}-actions`}>
            <button onClick={() => onVote(true)}>{yesLabel}</button>
            <button onClick={() => onVote(false)}>{noLabel}</button>
          </div>
        ) : (
          <div>Waiting for the other players</div>
        )}
      </div>
    </div>
  );
}
