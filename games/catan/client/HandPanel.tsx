import { useState } from 'react';
import { RESOURCES } from '../board.ts';
import { DEV_CARD_NAMES } from '../devCards.ts';
import { DEV_CARD_HELP, RESOURCE_LABELS } from './layout.ts';
import type { DevCard, Move, PublicGameState, Resource, Seat } from '../types.ts';

type HandPanelProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  canPlay: boolean; // the player's turn, no vote, nothing pending and no card played yet this turn
  onMove: (move: Move) => void;
};

function ResourceSelect({ value, onChange, label }: { value: Resource; onChange: (resource: Resource) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={event => onChange(event.target.value as Resource)}>
      {RESOURCES.map(resource => <option key={resource} value={resource}>{RESOURCE_LABELS[resource]}</option>)}
    </select>
  );
}

// One kind of development card the player holds, with how many and what playing it needs
function DevCardRow({ card, count, canPlay, onMove }: { card: DevCard; count: number; canPlay: boolean; onMove: (move: Move) => void }) {
  const [first, setFirst] = useState<Resource>('wood');
  const [second, setSecond] = useState<Resource>('brick');
  const [monopoly, setMonopoly] = useState<Resource>('wheat');
  let controls = null;
  if (card === 'knight') controls = <button type="button" disabled={!canPlay} onClick={() => onMove({ type: 'playKnight' })}>Play</button>;
  if (card === 'roadBuilding') controls = <button type="button" disabled={!canPlay} onClick={() => onMove({ type: 'playRoadBuilding' })}>Play</button>;
  if (card === 'yearOfPlenty') {
    controls = (
      <>
        <ResourceSelect label="First resource" value={first} onChange={setFirst} />
        <ResourceSelect label="Second resource" value={second} onChange={setSecond} />
        <button type="button" disabled={!canPlay} onClick={() => onMove({ type: 'playYearOfPlenty', resources: [first, second] })}>Play</button>
      </>
    );
  }
  if (card === 'monopoly') {
    controls = (
      <>
        <ResourceSelect label="Resource to take" value={monopoly} onChange={setMonopoly} />
        <button type="button" disabled={!canPlay} onClick={() => onMove({ type: 'playMonopoly', resource: monopoly })}>Play</button>
      </>
    );
  }
  return (
    <li className="dev-card" title={DEV_CARD_HELP[card]}>
      <span className="dev-card-name">{DEV_CARD_NAMES[card]}{count > 1 ? ` x${count}` : ''}</span>
      {controls && <span className="dev-card-controls">{controls}</span>}
    </li>
  );
}

function countCards(cards: DevCard[]): [DevCard, number][] {
  const counts = new Map<DevCard, number>();
  for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1);
  return [...counts.entries()];
}

// The player's own resource cards and development cards, which only they can see
export default function HandPanel({ gameState, playerNumber, canPlay, onMove }: HandPanelProps) {
  const { hand, myDevCards, myNewDevCards, steal, playerNames } = gameState;
  if (!hand) return null;
  let stealNote = null;
  if (steal?.resource && steal.thief === playerNumber) stealNote = `You stole 1 ${steal.resource} from ${playerNames[steal.victim]}`;
  if (steal?.resource && steal.victim === playerNumber) stealNote = `${playerNames[steal.thief]} stole your ${steal.resource}`;
  return (
    <section className="panel hand-panel" aria-label="Your cards">
      <div className="panel-title">Your cards</div>
      <div className="hand">
        {RESOURCES.map(resource => (
          <span key={resource} className={`resource-card res-${resource}`} title={RESOURCE_LABELS[resource]}>
            <span className="resource-name">{RESOURCE_LABELS[resource]}</span>
            <span className="resource-count">{hand[resource]}</span>
          </span>
        ))}
      </div>
      {stealNote && <p className="steal-note">{stealNote}</p>}
      {(myDevCards.length > 0 || myNewDevCards.length > 0) && (
        <ul className="dev-cards" aria-label="Your development cards">
          {countCards(myDevCards).map(([card, count]) => (
            <DevCardRow key={card} card={card} count={count} canPlay={canPlay} onMove={onMove} />
          ))}
          {countCards(myNewDevCards).map(([card, count]) => (
            <li key={`new-${card}`} className="dev-card dev-card-new" title={DEV_CARD_HELP[card]}>
              <span className="dev-card-name">{DEV_CARD_NAMES[card]}{count > 1 ? ` x${count}` : ''}</span>
              <span className="dev-card-note">{card === 'victoryPoint' ? 'counts now' : 'bought this turn'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
