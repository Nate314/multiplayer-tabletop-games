import Players from './Players';
import TableArea from './TableArea';
import Tile from './Tile';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one move, with the tiles that move put down highlighted, and the players then.
// Viewed as a player, their rack is shown below, read only. Seat 0 is nobody.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { table, lastMove, rack, playerNames } = gameState;
  const label = viewer === null ? '' : `${playerNames[viewer]}'s rack`;
  return (
    <div className="rk-history">
      <TableArea table={table} highlighted={lastMove?.type === 'play' ? lastMove.added : []} />
      <Players gameState={gameState} playerNumber={viewer ?? 0} />
      {viewer !== null && (
        <section className="rk-rack-area" aria-label={label}>
          <header className="rk-rack-header">{label}</header>
          <div className="rk-rack">
            {rack.map(id => <Tile key={id} id={id} />)}
          </div>
        </section>
      )}
    </div>
  );
}
