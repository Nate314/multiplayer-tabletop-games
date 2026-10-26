import { CardView, GemToken, NobleView } from './pieces';
import { cardKey, deckKey, nobleKey, supplyKey } from './animateMove.ts';
import { canBuy } from './selection.ts';
import { LEVELS } from '../cards.ts';
import { TOKENS } from '../rules.ts';
import type { Selection } from './selection.ts';
import type { Gem, PublicGameState, Seat } from '../types.ts';

type TableProps = {
  gameState: PublicGameState;
  seat: Seat | null;               // whose affordable cards are marked
  active: boolean;                 // whether the table takes clicks
  selection: Selection | null;
  onGem?: (gem: Gem) => void;
  onCard?: (selection: Selection) => void;
};

// The nobles, the three levels of cards with their decks, and the gem supply
export default function Table({ gameState, seat, active, selection, onGem, onCard }: TableProps) {
  const { nobles, market, deckCounts, supply } = gameState;
  const picked = selection?.kind === 'gems' ? selection.colors : [];

  return (
    <section className={active ? 'table hand-only-board' : 'table table-idle hand-only-board'} aria-label="Table">
      <div className="nobles" aria-label="Nobles">
        {nobles.map(noble => <NobleView key={noble} noble={noble} animKey={nobleKey(noble)} />)}
      </div>
      <div className="levels">
        {[...LEVELS].reverse().map(level => (
          <div className="level-row" key={level} aria-label={`Level ${level}`}>
            <div className="deck">
              {deckCounts[level] > 0
                ? (
                  <CardView
                    card={null}
                    level={level}
                    animKey={deckKey(level)}
                    selected={selection?.kind === 'deck' && selection.level === level}
                    onClick={active && onCard ? () => onCard({ kind: 'deck', level }) : undefined}
                  />
                )
                : <span className="dev-card dev-card-empty" data-anim-key={deckKey(level)}>Empty</span>}
              <span className="deck-count">{deckCounts[level]} left</span>
            </div>
            {market[level].map((card, slot) => {
              if (card === null) return <span key={`empty-${slot}`} className="dev-card dev-card-empty" />;
              const isSelected = selection?.kind === 'card' && selection.source.kind === 'market' &&
                selection.source.level === level && selection.source.slot === slot;
              return (
                <CardView
                  key={card}
                  card={card}
                  level={level}
                  animKey={cardKey(card)}
                  selected={isSelected}
                  affordable={seat !== null && canBuy(gameState, seat, card)}
                  onClick={active && onCard ? () => onCard({ kind: 'card', source: { kind: 'market', level, slot } }) : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="supply" aria-label="Gem supply">
        {TOKENS.map(token => (
          <GemToken
            key={token}
            token={token}
            count={supply[token]}
            size="large"
            animKey={supplyKey(token)}
            selected={token === 'gold' ? 0 : picked.filter(color => color === token).length}
            onClick={active && onGem && token !== 'gold' ? () => onGem(token) : undefined}
            disabled={supply[token] === 0}
            label={`${supply[token]} ${token} in the supply`}
          />
        ))}
      </div>
    </section>
  );
}
