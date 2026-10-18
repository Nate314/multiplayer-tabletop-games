import BattleDice from './BattleDice';
import CardHand from './CardHand';
import PlayerList from './PlayerList';
import WorldMap from './WorldMap';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The map right after one move, with the territories it touched outlined, the dice of a battle, and every player.
// Viewed as a player, that player's cards are shown; the table view shows none. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { lastMove, battle, hand } = gameState;
  const fought = lastMove?.type === 'attack' || lastMove?.type === 'blitz';
  return (
    <div className="history-layout">
      <div className="map-area">
        <WorldMap gameState={gameState} highlight={lastMove?.territories ?? []} />
      </div>
      {fought && <BattleDice battle={battle} playerNames={gameState.playerNames} />}
      {viewer !== null && hand && <CardHand gameState={gameState} hand={hand} playerNumber={viewer} />}
      <PlayerList gameState={gameState} viewer={viewer} />
    </div>
  );
}
