import VotePanel from './VotePanel';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type PauseVoteProps = {
  gameState: BasePublicState;
  voter: Seat | null; // null for a spectator or table screen, who only reads the list
  onVote: (approve: boolean) => void;
};

// Shows the open pause vote, if any. Every seated player votes, as the server waits for all of them
export default function PauseVote({ gameState, voter, onVote }: PauseVoteProps) {
  const vote = gameState.pauseVote;
  if (!vote) return null;

  return (
    <VotePanel
      className="pause-vote"
      title={`${gameState.playerNames[vote.requestedBy]} wants to pause the game`}
      votes={vote.votes}
      gameState={gameState}
      playerNumber={voter}
      onVote={onVote}
      voters={gameState.activePlayers}
    />
  );
}
