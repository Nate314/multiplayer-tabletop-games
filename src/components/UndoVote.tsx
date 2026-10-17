import VotePanel from './VotePanel';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type UndoVoteProps = {
  gameState: BasePublicState;
  playerNumber: Seat;
  onVote: (approve: boolean) => void;
};

// Shows the open undo vote, if any
export default function UndoVote({ gameState, playerNumber, onVote }: UndoVoteProps) {
  const vote = gameState.undoVote;
  if (!vote) return null;

  return (
    <VotePanel
      className="undo-vote"
      title={`${gameState.playerNames[vote.requestedBy]} wants to undo the last turn`}
      votes={vote.votes}
      gameState={gameState}
      playerNumber={playerNumber}
      onVote={onVote}
    />
  );
}
