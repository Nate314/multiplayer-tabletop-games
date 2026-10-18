import CardView from './CardView';
import Piles from './Piles';
import Table from './Table';
import { DEFAULT_SORT_ORDER, sortHand } from './sortHand.ts';
import type { DrawSource, PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The piles and every player's laid-down groups right after one move, with the pile or groups it used highlighted.
// Viewed as a player, their hand is shown below, read only. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { lastMove, phases, myHand, playerNames } = gameState;
  let lastPile: DrawSource | null = null;
  if (lastMove?.type === 'draw') lastPile = lastMove.source;
  if (lastMove?.type === 'discard') lastPile = 'discard';
  const label = viewer === null ? '' : `${playerNames[viewer]}'s hand (${myHand.length})`;

  return (
    <>
      <Piles gameState={gameState} canDraw={false} onDraw={() => {}} lastPile={lastPile} />
      <Table
        gameState={gameState}
        seats={Object.keys(phases).map(Number)}
        playerNumber={viewer}
        canHit={false}
        onHit={() => {}}
        lastMove={lastMove}
      />
      {viewer !== null && (
        <section className="my-hand" aria-label={label}>
          <header className="my-hand-header"><span>{label}</span></header>
          <div className="hand-cards">
            {sortHand(myHand, DEFAULT_SORT_ORDER).map(card => <CardView key={card.id} card={card} />)}
          </div>
        </section>
      )}
    </>
  );
}
