import Tile from './Tile';
import Table from './Table';
import { handKey } from './animateMove.ts';
import { tilePips } from '../rules.ts';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one move: the line with the tile just played highlighted, every tile count and score.
// Viewed as a player, their hand is shown below, read only. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { hand, playerNames, set } = gameState;
  const label = viewer === null ? '' : `${playerNames[viewer]}'s hand (${hand.length})`;
  return (
    <>
      <Table gameState={gameState} viewer={viewer} showLastMove />
      {viewer !== null && (
        <section className="hand" aria-label={label}>
          <header className="hand-header">{label}</header>
          <div className="hand-tiles">
            {hand.map(tile => <Tile key={tile} pips={tilePips(set, tile)} animKey={handKey(tile)} />)}
          </div>
        </section>
      )}
    </>
  );
}
