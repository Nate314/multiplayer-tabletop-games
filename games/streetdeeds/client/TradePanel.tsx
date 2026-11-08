import { useState } from 'react';
import { BOARD } from '../board.ts';
import { groupHasBuildings } from '../buildings.ts';
import { inGame } from '../state.ts';
import type { Action, PublicGameState, Seat, TradeSide } from '../types.ts';

type TradePanelProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  canAct: boolean;
  onAction: (action: Action) => void;
};

const EMPTY: TradeSide = { properties: [], cash: 0, jailCards: 0 };

function describeSide(side: TradeSide): string {
  const parts = side.properties.map(space => BOARD[space].name);
  if (side.cash > 0) parts.push(`$${side.cash}`);
  if (side.jailCards > 0) parts.push(`${side.jailCards} Get Out of Jail Free card${side.jailCards > 1 ? 's' : ''}`);
  return parts.length > 0 ? parts.join(', ') : 'nothing';
}

type SidePickerProps = {
  gameState: PublicGameState;
  seat: Seat;
  side: TradeSide;
  title: string;
  onChange: (side: TradeSide) => void;
};

// One side of an offer: the properties that may be traded (none with buildings in their group), cash and jail cards
function SidePicker({ gameState, seat, side, title, onChange }: SidePickerProps) {
  const { owners, cash, jailCards, mortgaged } = gameState;
  const tradable = Object.keys(owners).map(Number).filter(space => owners[space] === seat && !groupHasBuildings(gameState, space))
    .sort((a, b) => a - b);
  const toggle = (space: number) => onChange({
    ...side,
    properties: side.properties.includes(space) ? side.properties.filter(other => other !== space) : [...side.properties, space]
  });
  const count = (value: string, max: number) => Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
  const cards = jailCards[seat]?.length ?? 0;

  return (
    <fieldset className="trade-side">
      <legend>{title}</legend>
      {tradable.length === 0 && <div className="trade-none">No tradable properties</div>}
      {tradable.map(space => (
        <label key={space} className="trade-property">
          <input type="checkbox" checked={side.properties.includes(space)} onChange={() => toggle(space)} />
          {BOARD[space].name}{mortgaged.includes(space) ? ' (mortgaged)' : ''}
        </label>
      ))}
      <label className="trade-number">
        <span>Cash (of ${cash[seat] ?? 0})</span>
        <input type="number" min={0} max={cash[seat] ?? 0} step={1} value={side.cash}
          onChange={event => onChange({ ...side, cash: count(event.target.value, cash[seat] ?? 0) })} />
      </label>
      {cards > 0 && (
        <label className="trade-number">
          <span>Jail cards (of {cards})</span>
          <input type="number" min={0} max={cards} step={1} value={side.jailCards}
            onChange={event => onChange({ ...side, jailCards: count(event.target.value, cards) })} />
        </label>
      )}
    </fieldset>
  );
}

// The open offer, with Accept and Decline for the player it is for, or the form to make one
export default function TradePanel({ gameState, playerNumber, canAct, onAction }: TradePanelProps) {
  const { trade, playerNames, isGameOver } = gameState;
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<Seat | null>(null);
  const [give, setGive] = useState<TradeSide>(EMPTY);
  const [get, setGet] = useState<TradeSide>(EMPTY);
  const others = inGame(gameState).filter(seat => seat !== playerNumber);
  const playing = inGame(gameState).includes(playerNumber) && canAct;
  if (isGameOver) return null;

  if (trade) {
    return (
      <section className="panel trade-panel" aria-label="Trade offer">
        <div className="panel-title">Trade offer</div>
        <p className="trade-summary">
          {playerNames[trade.from]} gives {describeSide(trade.give)} to {playerNames[trade.to]} for {describeSide(trade.get)}.
        </p>
        {trade.to === playerNumber && canAct && (
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
  if (!playing || others.length === 0) return null;
  if (!open) {
    return (
      <section className="panel trade-panel" aria-label="Trade">
        <button type="button" onClick={() => setOpen(true)}>Propose a trade</button>
      </section>
    );
  }

  const partner = to !== null && others.includes(to) ? to : others[0];
  function send() {
    onAction({ type: 'offerTrade', to: partner, give, get });
    setOpen(false);
    setGive(EMPTY);
    setGet(EMPTY);
  }

  return (
    <section className="panel trade-panel" aria-label="Propose a trade">
      <div className="panel-title">Propose a trade</div>
      <label className="trade-partner">
        <span>With</span>
        <select value={partner} onChange={event => { setTo(Number(event.target.value)); setGet(EMPTY); }}>
          {others.map(seat => <option key={seat} value={seat}>{playerNames[seat]}</option>)}
        </select>
      </label>
      <div className="trade-sides">
        <SidePicker gameState={gameState} seat={playerNumber} side={give} title="You give" onChange={setGive} />
        <SidePicker gameState={gameState} seat={partner} side={get} title={`${playerNames[partner]} gives`} onChange={setGet} />
      </div>
      <div className="turn-buttons">
        <button type="button" className="primary" onClick={send}>Send offer</button>
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </section>
  );
}
