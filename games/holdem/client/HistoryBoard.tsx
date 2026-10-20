import Table from './Table';
import HandResultPanel from './HandResultPanel';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one move, with the player who moved outlined. Viewed as a player, their own hole cards are
// face up; the table view shows only the hands shown at a showdown. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="holdem-history">
      {gameState.handResult && <HandResultPanel gameState={gameState} />}
      <Table gameState={gameState} viewer={viewer} showLastMove />
    </div>
  );
}
