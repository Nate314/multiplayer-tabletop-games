import PlayerPanel from './PlayerPanel';
import Table from './Table';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table and every player right after one move, read only. The card bought or reserved and the player who moved are outlined.
// Viewed as a player, that player is marked as you and their unseen reserved cards are shown; the table view shows none.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="play-area">
      <Table gameState={gameState} seat={null} active={false} selection={null} />
      <div className="players">
        {Object.keys(gameState.players).map(Number).map(seat => (
          <PlayerPanel key={seat} gameState={gameState} seat={seat} isMe={seat === viewer} selection={null} />
        ))}
      </div>
    </div>
  );
}
