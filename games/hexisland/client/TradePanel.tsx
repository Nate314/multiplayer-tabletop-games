import { useState } from 'react';
import { RESOURCES } from '../board.ts';
import { describeResources, noResources, total } from '../resources.ts';
import { tradeAnswerers } from '../trades.ts';
import { RESOURCE_LABELS } from './layout.ts';
import type { Action, PublicGameState, Resource, Resources, Seat } from '../types.ts';

type TradePanelProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  canAct: boolean;
  onAction: (action: Action) => void;
};

function Counts({ title, counts, max, onChange }: { title: string; counts: Resources; max: Resources | null; onChange: (counts: Resources) => void }) {
  const change = (resource: Resource, by: number) => {
    const limit = max ? max[resource] : 19;
    onChange({ ...counts, [resource]: Math.max(0, Math.min(limit, counts[resource] + by)) });
  };
  return (
    <fieldset className="trade-side">
      <legend>{title}</legend>
      {RESOURCES.map(resource => (
        <div key={resource} className={`counter res-${resource}`}>
          <span className="counter-name">{RESOURCE_LABELS[resource]}</span>
          <button type="button" aria-label={`${title}: one less ${resource}`} disabled={counts[resource] === 0} onClick={() => change(resource, -1)}>-</button>
          <span className="counter-value">{counts[resource]}</span>
          <button type="button" aria-label={`${title}: one more ${resource}`} disabled={max !== null && counts[resource] >= max[resource]}
            onClick={() => change(resource, 1)}>+</button>
        </div>
      ))}
    </fieldset>
  );
}

// The open offer, with Accept and Decline for whoever it is for, or the turn holder's form to make one
export default function TradePanel({ gameState, playerNumber, canAct, onAction }: TradePanelProps) {
  const { trade, playerNames, activePlayers, isGameOver, turnHolder, rolled, pending, setup, hand } = gameState;
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<Seat | null>(null);
  const [give, setGive] = useState<Resources>(noResources);
  const [get, setGet] = useState<Resources>(noResources);
  if (isGameOver || setup) return null;

  if (trade) {
    const answering = canAct && tradeAnswerers(gameState).includes(playerNumber);
    const toWhom = trade.to === null ? 'anyone' : playerNames[trade.to];
    const waitingOn = tradeAnswerers(gameState).map(seat => playerNames[seat]).join(', ');
    return (
      <section className="panel trade-panel" aria-label="Trade offer">
        <div className="panel-title">Trade offer</div>
        <p className="trade-summary">
          {playerNames[trade.from]} offers {toWhom} {describeResources(trade.give)} for {describeResources(trade.get)}.
        </p>
        {waitingOn && <p className="turn-note">Waiting for an answer from {waitingOn}.</p>}
        {answering && (
          <div className="turn-buttons">
            <button type="button" className="primary" onClick={() => onAction({ type: 'answerTrade', accept: true })}>Accept</button>
            <button type="button" onClick={() => onAction({ type: 'answerTrade', accept: false })}>Decline</button>
          </div>
        )}
        {trade.from === playerNumber && canAct && (
          <button type="button" onClick={() => onAction({ type: 'cancelTrade' })}>Withdraw offer</button>
        )}
      </section>
    );
  }
  const others = activePlayers.filter(seat => seat !== playerNumber);
  if (!canAct || turnHolder !== playerNumber || !rolled || pending || !hand) return null;
  if (!open) {
    return (
      <section className="panel trade-panel" aria-label="Trade">
        <button type="button" onClick={() => setOpen(true)}>Offer a trade to other players</button>
      </section>
    );
  }

  const partner = to !== null && others.includes(to) ? to : null;
  const both = RESOURCES.some(resource => give[resource] > 0 && get[resource] > 0);
  let why = '';
  if (total(give) === 0 || total(get) === 0) why = 'Each side must give at least one card';
  else if (both) why = 'A resource cannot be on both sides';
  function send() {
    onAction({ type: 'offerTrade', to: partner, give, get });
    setOpen(false);
    setGive(noResources());
    setGet(noResources());
  }

  return (
    <section className="panel trade-panel" aria-label="Offer a trade">
      <div className="panel-title">Offer a trade</div>
      <label className="trade-partner">
        <span>To</span>
        <select value={partner ?? ''} onChange={event => setTo(event.target.value === '' ? null : Number(event.target.value))}>
          <option value="">Everyone</option>
          {others.map(seat => <option key={seat} value={seat}>{playerNames[seat]}</option>)}
        </select>
      </label>
      <div className="trade-sides">
        <Counts title="You give" counts={give} max={hand} onChange={setGive} />
        <Counts title="You get" counts={get} max={null} onChange={setGet} />
      </div>
      <div className="turn-buttons">
        <button type="button" className="primary" disabled={why !== ''} title={why || undefined} onClick={send}>Send offer</button>
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </section>
  );
}
