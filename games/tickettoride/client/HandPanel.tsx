import { CardFace, TicketFace } from './pieces';
import { CARDS } from '../cards.ts';
import { ticketDone } from '../scoring.ts';
import type { Card, PublicGameState, PublicPlayer, Seat } from '../types.ts';

type HandPanelProps = {
  gameState: Pick<PublicGameState, 'claimed'>;
  seat: Seat;
  player: PublicPlayer;
  title: string;
  drawn?: Card[]; // the colors to outline as newly drawn
  onTicket?: (ticket: number | null) => void; // hovering or focusing a ticket rings its cities on the map
};

// One player's own train cards, grouped by color, and their destination tickets with the completed ones marked
export default function HandPanel({ gameState, seat, player, title, drawn = [], onTicket }: HandPanelProps) {
  const { hand, tickets } = player;
  if (!hand || !tickets) return null;
  const held = CARDS.filter(card => hand[card] > 0);
  const done = tickets.filter(ticket => ticketDone(gameState.claimed, seat, ticket)).length;
  return (
    <section className="hand-panel" aria-label={title}>
      <h2>{title}</h2>
      <div className="hand">
        {held.length === 0 ? <span className="muted">No train cards</span> : held.map(card => <CardFace key={card} card={card} count={hand[card]} drawn={drawn.includes(card)} />)}
      </div>
      <h3>Destination tickets{tickets.length > 0 ? ` (${done} of ${tickets.length} completed)` : ''}</h3>
      <ul className="tickets">
        {tickets.map(ticket => (
          <li
            key={ticket}
            tabIndex={onTicket ? 0 : undefined}
            onMouseEnter={() => onTicket?.(ticket)}
            onMouseLeave={() => onTicket?.(null)}
            onFocus={() => onTicket?.(ticket)}
            onBlur={() => onTicket?.(null)}
          >
            <TicketFace ticket={ticket} done={ticketDone(gameState.claimed, seat, ticket)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
