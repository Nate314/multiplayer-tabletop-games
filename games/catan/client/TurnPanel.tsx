import { useState } from 'react';
import { RESOURCES } from '../board.ts';
import { COSTS, covers, describeResources } from '../resources.ts';
import { tradeRatio } from '../trades.ts';
import { RESOURCE_LABELS } from './layout.ts';
import type { Move, PublicGameState, Resource, Seat } from '../types.ts';

export type BuildMode = 'road' | 'settlement' | 'city' | null;

type TurnPanelProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  canMove: boolean; // it is this player's move and no vote is running
  mode: BuildMode;
  spots: Record<'road' | 'settlement' | 'city', number>; // how many places each piece could go now
  victims: Seat[] | null; // players to choose from after clicking a robber hex with more than one
  onMode: (mode: BuildMode) => void;
  onSteal: (victim: Seat) => void;
  onMove: (move: Move) => void;
};

function BankTrade({ gameState, playerNumber, onMove }: { gameState: PublicGameState; playerNumber: Seat; onMove: (move: Move) => void }) {
  const [give, setGive] = useState<Resource>('wood');
  const [get, setGet] = useState<Resource>('ore');
  const ratio = tradeRatio(gameState, playerNumber, give);
  const have = gameState.hand?.[give] ?? 0;
  let why = '';
  if (give === get) why = 'Choose two different resources';
  else if (have < ratio) why = `You need ${ratio} ${give}`;
  else if (gameState.bank[get] < 1) why = `The bank has no ${get}`;
  return (
    <div className="bank-trade">
      <span>Bank trade</span>
      <select aria-label="Give to the bank" value={give} onChange={event => setGive(event.target.value as Resource)}>
        {RESOURCES.map(resource => (
          <option key={resource} value={resource}>{tradeRatio(gameState, playerNumber, resource)} {RESOURCE_LABELS[resource]}</option>
        ))}
      </select>
      <span>for 1</span>
      <select aria-label="Take from the bank" value={get} onChange={event => setGet(event.target.value as Resource)}>
        {RESOURCES.map(resource => <option key={resource} value={resource}>{RESOURCE_LABELS[resource]}</option>)}
      </select>
      <button type="button" disabled={why !== ''} title={why || undefined} onClick={() => onMove({ type: 'bankTrade', give, get })}>Trade</button>
    </div>
  );
}

// What the player who must move can do now: place in setup, move the robber, place free roads, roll, build, buy, trade, end the turn
export default function TurnPanel(props: TurnPanelProps) {
  const { gameState, playerNumber, canMove, mode, spots, victims, onMode, onSteal, onMove } = props;
  const { setup, pending, rolled, playerNames, currentPlayer, isGameOver, hand, devDeckCount } = gameState;
  if (isGameOver || currentPlayer === null) return null;

  const discarding = pending?.kind === 'discard'
    ? Object.entries(pending.counts).map(([seat, count]) => `${playerNames[Number(seat)]} (${count})`).join(', ')
    : '';

  if (!canMove || discarding) {
    let waiting = `Waiting for ${playerNames[currentPlayer]}`;
    if (setup) waiting = `Waiting for ${playerNames[currentPlayer]} to place a ${setup.settlement === null ? 'settlement' : 'road'}`;
    if (discarding) waiting = `Waiting for discards: ${discarding}`;
    return <section className="panel turn-panel" aria-label="Turn"><div className="turn-waiting">{waiting}</div></section>;
  }

  let body;
  if (setup) {
    body = <p className="turn-note">{setup.settlement === null
      ? 'Place a settlement: click a highlighted intersection.'
      : 'Place a road next to it: click a highlighted path.'}</p>;
  } else if (pending?.kind === 'robber') {
    body = victims ? (
      <div className="turn-buttons">
        <span className="turn-note">Steal from</span>
        {victims.map(victim => <button key={victim} type="button" className="primary" onClick={() => onSteal(victim)}>{playerNames[victim]}</button>)}
      </div>
    ) : <p className="turn-note">Move the robber: click a highlighted hex.</p>;
  } else if (pending?.kind === 'roadBuilding') {
    body = <p className="turn-note">Place {pending.roads} free road{pending.roads > 1 ? 's' : ''}: click a highlighted path.</p>;
  } else if (!rolled) {
    body = (
      <div className="turn-buttons">
        <button type="button" className="primary" onClick={() => onMove({ type: 'roll' })}>Roll the dice</button>
        <span className="turn-note">You may play a development card first.</span>
      </div>
    );
  } else {
    const have = hand ?? COSTS.road;
    const buildButton = (kind: 'road' | 'settlement' | 'city', label: string) => {
      let why = '';
      if (!covers(have, COSTS[kind])) why = `Needs ${describeResources(COSTS[kind])}`;
      else if (spots[kind] === 0) why = `Nowhere to build a ${kind}`;
      return (
        <button type="button" className={mode === kind ? 'selected' : ''} aria-pressed={mode === kind} disabled={why !== '' && mode !== kind}
          title={why || `Costs ${describeResources(COSTS[kind])}`} onClick={() => onMode(mode === kind ? null : kind)}>
          {mode === kind ? 'Cancel' : label}
        </button>
      );
    };
    const cardWhy = devDeckCount === 0 ? 'The deck is empty' : covers(have, COSTS.devCard) ? '' : `Needs ${describeResources(COSTS.devCard)}`;
    body = (
      <>
        <div className="turn-buttons build-buttons">
          {buildButton('road', 'Build road')}
          {buildButton('settlement', 'Build settlement')}
          {buildButton('city', 'Build city')}
          <button type="button" disabled={cardWhy !== ''} title={cardWhy || `Costs ${describeResources(COSTS.devCard)}`}
            onClick={() => onMove({ type: 'buyDevCard' })}>Buy development card</button>
        </div>
        {mode && <p className="turn-note">Click a highlighted {mode === 'road' ? 'path' : 'intersection'}.</p>}
        <BankTrade gameState={gameState} playerNumber={playerNumber} onMove={onMove} />
        <div className="turn-buttons">
          <button type="button" className="primary" onClick={() => onMove({ type: 'endTurn' })}>End turn</button>
        </div>
      </>
    );
  }

  return (
    <section className="panel turn-panel" aria-label="Your turn">
      <div className="panel-title">{setup ? 'Setup' : 'Your turn'}</div>
      {body}
    </section>
  );
}
