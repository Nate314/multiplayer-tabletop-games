import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { CITIES, TICKETS } from '../map.ts';
import { cardLabel } from './labels.ts';
import type { Card } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { cardArtUrl } from '../../../src/components/pieces.ts';

// One train card face: its color, with the name written on it so colors are never the only cue
export function CardFace({ card, count, drawn = false }: { card: Card; count?: number; drawn?: boolean }) {
  return (
    <span className={drawn ? `card card-${card} newly-drawn` : `card card-${card}`}>
      <ServerSvg url={cardArtUrl(card === 'locomotive' ? 'bands' : 'solid')} className="piece-art" />
      <ColorSymbol color={card === 'locomotive' ? null : card} />
      <span className="card-name">{card === 'locomotive' ? 'Loco' : cardLabel(card)}</span>
      {count !== undefined && <span className="card-count">{count}</span>}
    </span>
  );
}

// A ticket marked done, or missed once the game is scored
export function TicketFace({ ticket, done, missed }: { ticket: number; done?: boolean; missed?: boolean }) {
  const { a, b, points } = TICKETS[ticket];
  return (
    <span className={done ? 'ticket done' : 'ticket'}>
      <span className="ticket-cities">{CITIES[a].name} to {CITIES[b].name}</span>
      <span className="ticket-points">{points}</span>
      {done && <span className="ticket-mark" aria-label="completed">✓</span>}
      {missed && <span className="ticket-mark missed-mark" aria-label="not completed">✗</span>}
    </span>
  );
}
