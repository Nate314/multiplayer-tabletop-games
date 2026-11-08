import { useState } from 'react';
import { TicketFace } from './pieces';
import { ROUTES, routeName } from '../map.ts';
import { canAct, claimError, describePayment, paymentOptions, ticketsToKeep } from '../rules.ts';
import type { Move, PublicGameState, Seat } from '../types.ts';

type TurnPanelProps = {
  gameState: PublicGameState;
  seat: Seat;
  isMyTurn: boolean;
  selectedRoute: number | null;
  onMove: (move: Move) => void;
  onClear: () => void;
  onTicket: (ticket: number | null) => void;
};

// Choosing which offered tickets to keep. It shows while the offer waits, and Keep works once it is the player's turn.
function TicketChoice({ gameState, offered, isMyTurn, onMove, onTicket }: {
  gameState: PublicGameState; offered: number[]; isMyTurn: boolean; onMove: (move: Move) => void; onTicket: (ticket: number | null) => void;
}) {
  const [kept, setKept] = useState<number[]>(offered);
  const minimum = ticketsToKeep(gameState.phase, offered.length);
  const toggle = (ticket: number) => setKept(previous => previous.includes(ticket) ? previous.filter(id => id !== ticket) : [...previous, ticket]);
  return (
    <div className="turn-panel">
      <p className="turn-panel-title">
        {gameState.phase === 'setup' ? 'Your first destination tickets.' : 'Destination tickets drawn.'} Keep at least {minimum}; the rest go under the deck.
      </p>
      <ul className="ticket-choice">
        {offered.map(ticket => (
          <li key={ticket} onMouseEnter={() => onTicket(ticket)} onMouseLeave={() => onTicket(null)}>
            <label>
              <input type="checkbox" checked={kept.includes(ticket)} onChange={() => toggle(ticket)}
                onFocus={() => onTicket(ticket)} onBlur={() => onTicket(null)} />
              <TicketFace ticket={ticket} />
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="primary-action" disabled={!isMyTurn || kept.length < minimum}
        onClick={() => onMove({ type: 'keepTickets', tickets: offered.filter(id => kept.includes(id)) })}>
        Keep {kept.length} ticket{kept.length === 1 ? '' : 's'}
      </button>
      {!isMyTurn && <p className="turn-panel-note">You can choose when your turn comes.</p>}
    </div>
  );
}

// Paying for the picked route: one button per way to pay when there is a choice
function ClaimPanel({ gameState, seat, route, onMove, onClear }: { gameState: PublicGameState; seat: Seat; route: number; onMove: (move: Move) => void; onClear: () => void }) {
  const me = gameState.players[seat];
  const target = ROUTES[route];
  const hand = me.hand;
  const error = hand ? claimError(gameState, seat, { hand, trains: me.trains }, target) : 'You have no hand';
  const options = hand && !error ? paymentOptions(hand, target) : [];
  return (
    <div className="turn-panel">
      <p className="turn-panel-title">
        {routeName(target)}: {target.length} {target.color === 'gray' ? 'gray (any one color)' : target.color}
      </p>
      {error && <p className="turn-panel-note">{error}</p>}
      {options.length > 1 && <p className="turn-panel-note">Choose how to pay:</p>}
      <div className="turn-actions">
        {options.map(payment => (
          <button key={payment.color ?? 'locomotives'} type="button" className="primary-action"
            onClick={() => onMove({ type: 'claim', route, payment })}>
            Claim with {describePayment(payment, target.length)}
          </button>
        ))}
        <button type="button" onClick={onClear}>Cancel</button>
      </div>
    </div>
  );
}

// What the player can do now: choose tickets, take a second card, pay for a picked route, or the turn's three choices
export default function TurnPanel({ gameState, seat, isMyTurn, selectedRoute, onMove, onClear, onTicket }: TurnPanelProps) {
  const me = gameState.players[seat];
  if (!me) return null;
  if (me.offered) {
    // Keyed by the offer, so a new draw or an undo starts from every ticket kept
    return <TicketChoice key={me.offered.join('-')} gameState={gameState} offered={me.offered} isMyTurn={isMyTurn} onMove={onMove} onTicket={onTicket} />;
  }
  if (!isMyTurn || gameState.phase === 'setup') return null;
  if (gameState.drawing === seat) {
    return (
      <div className="turn-panel">
        <p className="turn-panel-title">Take your second card: any face-up card except a locomotive, or the top of the deck.</p>
      </div>
    );
  }
  if (selectedRoute !== null) return <ClaimPanel gameState={gameState} seat={seat} route={selectedRoute} onMove={onMove} onClear={onClear} />;
  const stuck = me.hand ? !canAct(gameState, seat, { hand: me.hand, trains: me.trains }) : false;
  return (
    <div className="turn-panel">
      <p className="turn-panel-title">
        {stuck
          ? 'There is nothing you can draw or claim.'
          : 'Take 2 train cards, click a route on the map to claim it, or draw destination tickets.'}
      </p>
      {stuck && <button type="button" className="primary-action" onClick={() => onMove({ type: 'pass' })}>Pass</button>}
    </div>
  );
}
