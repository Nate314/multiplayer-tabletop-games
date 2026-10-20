import type { PublicGameState, Seat } from '../types.ts';

type ActionButtonsProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  onUndo: () => void;
};

export default function ActionButtons({
  gameState,
  playerNumber,
  onUndo,
}: ActionButtonsProps) {
  const { activePlayers, undoAvailable, undoVote, dismissVote } = gameState;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  return (
    <div className="action-buttons">
      <button onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
    </div>
  );
}
