import PlayingCard from '../../../src/components/PlayingCard';
import PegBoard from './PegBoard';
import PeggingArea from './PeggingArea';
import ShowPanel from './ShowPanel';
import { sortedHand } from '../scoring.ts';
import type { PublicGameState, Seat } from '../types.ts';

// The board right after one move, with the card just played highlighted, and the viewer's hand read only
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { hand, playerNames, phase, showIndex } = gameState;
  const label = viewer === null ? '' : `${playerNames[viewer]}'s hand (${hand.length})`;
  return (
    <>
      <PegBoard gameState={gameState} viewer={viewer} />
      <PeggingArea gameState={gameState} viewer={viewer} showLastMove />
      {phase === 'show' && <ShowPanel key={showIndex} gameState={gameState} viewer={viewer} controls={false} />}
      {viewer !== null && (
        <section className="hand" aria-label={label}>
          <header className="hand-header">{label}</header>
          <div className="hand-cards">
            {sortedHand(hand).map(card => <PlayingCard key={`${card.rank}${card.suit}`} card={card} />)}
          </div>
        </section>
      )}
    </>
  );
}
