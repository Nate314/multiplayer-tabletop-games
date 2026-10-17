import VotePanel from './VotePanel';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type DismissVoteProps = {
  gameState: BasePublicState;
  playerNumber: Seat;
  onVote: (approve: boolean) => void;
};

// Shows the open dismiss vote, if any
export default function DismissVote({ gameState, playerNumber, onVote }: DismissVoteProps) {
  const vote = gameState.dismissVote;
  if (!vote) return null;

  const { playerNames } = gameState;
  return (
    <VotePanel
      className="dismiss-vote"
      title={`${playerNames[vote.requestedBy]} wants to dismiss ${playerNames[vote.target]}`}
      votes={vote.votes}
      gameState={gameState}
      playerNumber={playerNumber}
      onVote={onVote}
    />
  );
}
