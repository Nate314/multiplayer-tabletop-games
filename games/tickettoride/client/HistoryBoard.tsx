import HandPanel from './HandPanel';
import MapBoard from './MapBoard';
import Market from './Market';
import PlayerList, { FinalScores } from './PlayerList';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The map and the table right after one move, read only, with the route just claimed outlined.
// Viewed as a player, that player's hand and tickets are shown; the table view shows none until the final scoring.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const player = viewer === null ? null : gameState.players[viewer];
  return (
    <div className="ttr-layout history-layout">
      <div className="map-area">
        <MapBoard gameState={gameState} highlight={gameState.lastMove?.type === 'claim' ? gameState.lastMove.route : null} />
        <FinalScores gameState={gameState} />
      </div>
      <div className="side-panel">
        <Market gameState={gameState} canDraw={false} second={false} canTickets={false} />
        {viewer !== null && player && <HandPanel gameState={gameState} seat={viewer} player={player} title={`${gameState.playerNames[viewer]}'s hand`} />}
        <PlayerList gameState={gameState} viewer={viewer} />
      </div>
    </div>
  );
}
