import VotePanel from './VotePanel';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type RematchVoteProps = {
  gameState: BasePublicState;
  viewer: Seat | null; // null for a spectator
  onVote: (join: boolean) => void;
  onRemove: (seat: Seat) => void;
};

// Shows the open rematch vote, if any. Everyone at the table answers, connected or not; a spectator only watches.
export default function RematchVote({ gameState, viewer, onVote, onRemove }: RematchVoteProps) {
  const vote = gameState.rematchVote;
  if (!vote) return null;

  return (
    <VotePanel
      className="rematch-vote"
      title={`${gameState.playerNames[vote.requestedBy]} wants a rematch`}
      votes={vote.votes}
      gameState={gameState}
      playerNumber={viewer}
      onVote={onVote}
      voters={gameState.activePlayers}
      yesLabel="Join"
      noLabel="Drop"
      answer={seat => vote.votes[seat] === undefined ? 'waiting' : vote.votes[seat] ? 'joined' : 'dropped'}
      onRemove={viewer === null ? undefined : onRemove}
    />
  );
}
