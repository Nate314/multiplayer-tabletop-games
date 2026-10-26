import VotePanel from './VotePanel';
import { dismissVoters } from '../../shared/seating.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type DismissVoteProps = {
  gameState: BasePublicState;
  playerNumber: Seat;
  onVote: (approve: boolean) => void;
};

// Shows the open dismiss vote, if any
export default function DismissVote({ gameState, playerNumber, onVote }: DismissVoteProps) {
  const vote = gameState.dismissVote;
  // The target never votes on their own dismissal; in a rematch they answer the rematch instead,
  // and only the seats that joined it have a say
  const voters = dismissVoters(gameState);
  if (!vote || !voters.includes(playerNumber)) return null;

  const { playerNames } = gameState;
  return (
    <VotePanel
      className="dismiss-vote"
      title={`${playerNames[vote.requestedBy]} wants to dismiss ${playerNames[vote.target]}`}
      votes={vote.votes}
      gameState={gameState}
      playerNumber={playerNumber}
      onVote={onVote}
      voters={voters}
    />
  );
}
