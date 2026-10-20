import PlayingCard from '../../../src/components/PlayingCard';
import Table from './Table';
import { sortedHand } from './animateMove.ts';
import { handKey } from '../../../src/animation/animKeys.ts';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one move, with the card just played highlighted. Viewed as a player, their hand is shown
// below, read only. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { hand, playerNames } = gameState;
  const label = viewer === null ? '' : `${playerNames[viewer]}'s hand (${hand.length})`;
  return (
    <>
      <Table gameState={gameState} viewer={viewer} showLastMove />
      {viewer !== null && (
        <section className="hand" aria-label={label}>
          <header className="hand-header">{label}</header>
          <div className="hand-cards">
            {sortedHand(hand).map((card, slot) => <PlayingCard key={slot} card={card} animKey={handKey(slot)} />)}
          </div>
        </section>
      )}
    </>
  );
}
