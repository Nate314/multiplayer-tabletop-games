import Hand from './Hand';
import Table from './Table';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one ask, with the asker and the player asked highlighted. Viewed as a player, their hand is
// shown below, read only. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { hand, playerNames } = gameState;
  return (
    <div className="gofish-board">
      <Table gameState={gameState} viewer={viewer} showLastMove />
      {viewer !== null && <Hand hand={hand} label={`${playerNames[viewer]}'s hand (${hand.length})`} />}
    </div>
  );
}
