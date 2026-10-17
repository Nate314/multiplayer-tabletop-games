import type { PublicGameState, Seat } from '../types.ts';

type ActionButtonsProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  lastMovePinned: boolean;
  onUndo: () => void;
  onToggleLastMovePinned: () => void;
  onLastMoveHover: (hovered: boolean) => void;
};

export default function ActionButtons({
  gameState,
  playerNumber,
  lastMovePinned,
  onUndo,
  onToggleLastMovePinned,
  onLastMoveHover,
}: ActionButtonsProps) {
  const { activePlayers, undoAvailable, undoVote, dismissVote, lastMove } = gameState;
  const canUndo = undoAvailable && !undoVote && !dismissVote && activePlayers.includes(playerNumber) && activePlayers.length >= 2;

  return (
    <div className="action-buttons">
      <button onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button
        onClick={onToggleLastMovePinned}
        onMouseEnter={() => onLastMoveHover(true)}
        onMouseLeave={() => onLastMoveHover(false)}
        className={lastMovePinned ? 'active' : ''}
        disabled={!lastMove}
      >
        Show Last Move
      </button>
    </div>
  );
}
