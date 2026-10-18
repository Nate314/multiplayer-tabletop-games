import { CITIES, TICKETS } from '../map.ts';
import { cardLabel } from './labels.ts';
import type { Card } from '../types.ts';

// One train card face: its color, with the name written on it so colors are never the only cue
export function CardFace({ card, count }: { card: Card; count?: number }) {
  return (
    <span className={`card card-${card}`}>
      <span className="card-name">{card === 'locomotive' ? 'Loco' : cardLabel(card)}</span>
      {count !== undefined && <span className="card-count">{count}</span>}
    </span>
  );
}

export function TicketFace({ ticket, done }: { ticket: number; done?: boolean }) {
  const { a, b, points } = TICKETS[ticket];
  return (
    <span className={done ? 'ticket done' : 'ticket'}>
      <span className="ticket-cities">{CITIES[a].name} to {CITIES[b].name}</span>
      <span className="ticket-points">{points}</span>
      {done && <span className="ticket-mark" aria-label="completed">✓</span>}
    </span>
  );
}
