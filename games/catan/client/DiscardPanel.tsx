import { useState } from 'react';
import { RESOURCES } from '../board.ts';
import { noResources, total } from '../resources.ts';
import { RESOURCE_LABELS } from './layout.ts';
import type { Action, PublicGameState, Resources, Seat } from '../types.ts';

type DiscardPanelProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  canAct: boolean;
  onAction: (action: Action) => void;
};

// After a 7, a player holding more than 7 cards picks half of them to give back
export default function DiscardPanel({ gameState, playerNumber, canAct, onAction }: DiscardPanelProps) {
  const [cards, setCards] = useState<Resources>(noResources);
  const { pending, hand } = gameState;
  if (pending?.kind !== 'discard' || !(playerNumber in pending.counts) || !hand) return null;
  const count = pending.counts[playerNumber];
  const chosen = total(cards);
  const change = (resource: keyof Resources, by: number) =>
    setCards(current => ({ ...current, [resource]: Math.max(0, Math.min(hand[resource], current[resource] + by)) }));

  return (
    <section className="panel discard-panel" aria-label="Discard">
      <div className="panel-title">A 7: discard {count} cards</div>
      <div className="counters">
        {RESOURCES.map(resource => (
          <div key={resource} className={`counter res-${resource}`}>
            <span className="counter-name">{RESOURCE_LABELS[resource]} ({hand[resource]})</span>
            <button type="button" aria-label={`One less ${resource}`} disabled={cards[resource] === 0} onClick={() => change(resource, -1)}>-</button>
            <span className="counter-value">{cards[resource]}</span>
            <button type="button" aria-label={`One more ${resource}`} disabled={cards[resource] >= hand[resource] || chosen >= count}
              onClick={() => change(resource, 1)}>+</button>
          </div>
        ))}
      </div>
      <div className="turn-buttons">
        <button type="button" className="primary" disabled={!canAct || chosen !== count}
          onClick={() => { onAction({ type: 'discard', resources: cards }); setCards(noResources()); }}>
          Discard {chosen} of {count}
        </button>
      </div>
    </section>
  );
}
