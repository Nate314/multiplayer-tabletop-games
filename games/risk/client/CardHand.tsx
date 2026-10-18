import { useState } from 'react';
import { MUST_TRADE_AT, isSet, setValue } from '../cards.ts';
import { cardSymbol, cardTerritory, territoryName } from '../map.ts';
import type { Card, Move, PublicGameState, Seat } from '../types.ts';

type CardHandProps = {
  gameState: PublicGameState;
  hand: Card[];
  playerNumber: Seat | null;
  canTrade?: boolean; // it is this player's reinforce phase and no vote is running
  onMove?: (move: Move) => void;
};

const SYMBOL_LETTER = { infantry: 'I', cavalry: 'C', artillery: 'A', wild: 'W' };

// The viewer's cards; on their turn, pick three that make a set and trade them for armies
export default function CardHand({ gameState, hand, playerNumber, canTrade = false, onMove }: CardHandProps) {
  const [picked, setPicked] = useState<Card[]>([]);
  const { owners, tradeCount, midTurnTrade } = gameState;
  const tradable = canTrade && (!midTurnTrade || hand.length >= MUST_TRADE_AT);
  const chosen = picked.filter(card => hand.includes(card));
  const toggle = (card: Card) => setPicked(current => current.includes(card)
    ? current.filter(other => other !== card)
    : current.length < 3 ? [...current, card] : current);

  return (
    <section className="panel card-hand" aria-label="Your cards">
      <div className="panel-title">Your cards ({hand.length})</div>
      {hand.length === 0 && <p className="note">No cards yet. Capture a territory in a turn to earn one.</p>}
      <div className="cards">
        {hand.map(card => {
          const symbol = cardSymbol(card);
          const territory = cardTerritory(card);
          const yours = territory !== null && owners[territory] === playerNumber;
          const classNames = ['risk-card', `card-${symbol}`];
          if (chosen.includes(card)) classNames.push('card-picked');
          const content = (
            <>
              <span className="card-symbol" aria-hidden="true">{SYMBOL_LETTER[symbol]}</span>
              <span className="card-text">
                <span className="card-territory">{territory ? territoryName(territory) : 'Wild'}</span>
                <span className="card-kind">{symbol}{yours && ', yours'}</span>
              </span>
            </>
          );
          return tradable ? (
            <button key={card} type="button" className={classNames.join(' ')} aria-pressed={chosen.includes(card)} onClick={() => toggle(card)}>
              {content}
            </button>
          ) : <div key={card} className={classNames.join(' ')}>{content}</div>;
        })}
      </div>
      {tradable && hand.length >= 3 && (
        <div className="trade-row">
          <button type="button" className="primary" disabled={!isSet(chosen)}
            onClick={() => { onMove?.({ type: 'trade', cards: chosen }); setPicked([]); }}>
            Trade for {setValue(tradeCount)} armies
          </button>
          <span className="note">{chosen.length < 3 ? 'Pick three: alike, one of each, or two and a wild' : !isSet(chosen) ? 'Not a set' : ''}</span>
        </div>
      )}
    </section>
  );
}
