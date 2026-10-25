import { CardFace } from './pieces';
import { cardLabel } from './labels.ts';
import { slotKey } from './animateMove.ts';
import type { CardSource, PublicGameState } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { cardArtUrl } from '../../../src/components/pieces.ts';

type MarketProps = {
  gameState: Pick<PublicGameState, 'faceUp' | 'deckCount' | 'discardCount' | 'ticketDeckCount'>;
  canDraw: boolean;     // the viewer may take a card now
  second: boolean;      // taking their second card, so no face-up locomotive
  canTickets: boolean;  // the viewer may draw destination tickets now
  onDraw?: (source: CardSource) => void;
  onTickets?: () => void;
};

// The five face-up cards, the deck and the destination ticket deck
export default function Market({ gameState, canDraw, second, canTickets, onDraw, onTickets }: MarketProps) {
  const { faceUp, deckCount, discardCount, ticketDeckCount } = gameState;
  const deckLeft = deckCount + discardCount;
  return (
    <section className="market" aria-label="Train cards to draw">
      <div className="face-up">
        {faceUp.map((card, slot) => {
          if (card === null) return <span key={slot} className="card empty" data-anim-key={slotKey(slot)}>Empty</span>;
          const allowed = canDraw && !(second && card === 'locomotive');
          return (
            <button
              key={slot}
              type="button"
              className="card-button"
              data-anim-key={slotKey(slot)}
              disabled={!allowed}
              title={second && card === 'locomotive' ? 'A face-up locomotive cannot be your second card' : `Take the ${cardLabel(card)} card`}
              onClick={() => onDraw?.(slot)}
            >
              <CardFace card={card} />
            </button>
          );
        })}
      </div>
      <div className="decks">
        <button type="button" className="deck-button" disabled={!canDraw || deckLeft === 0} onClick={() => onDraw?.('deck')}>
          <span className="card card-back"><ServerSvg url={cardArtUrl('stripes')} className="piece-art" /><span className="card-name">Deck</span></span>
          <span className="deck-count">{deckCount} left{discardCount > 0 ? `, ${discardCount} discarded` : ''}</span>
        </button>
        <button type="button" className="deck-button" disabled={!canTickets || ticketDeckCount === 0} onClick={() => onTickets?.()}>
          <span className="ticket-back">Tickets</span>
          <span className="deck-count">{ticketDeckCount} left</span>
        </button>
      </div>
    </section>
  );
}
