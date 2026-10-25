import PlayingCard from '../../../src/components/PlayingCard';
import { cardKey, groupByRank } from './animateMove.ts';
import { rankPlural } from '../rules.ts';
import type { PlayingCard as CardData, Rank } from '../types.ts';

type HandProps = {
  hand: CardData[];
  label: string;
  waiting?: boolean;
  // Given only while the player may ask: clicking a card picks its rank
  onPickRank?: (rank: Rank) => void;
  rank?: Rank | null;
  // Keys (cardKey) of the cards to outline as newly drawn
  drawnKeys?: string[];
};

// A hand grouped by rank, ace to king
export default function Hand({ hand, label, waiting = false, onPickRank, rank = null, drawnKeys = [] }: HandProps) {
  return (
    <section className={waiting ? 'hand hand-waiting' : 'hand'} aria-label={label}>
      <header className="hand-header">{label}</header>
      {hand.length === 0 && <p className="hand-empty">No cards</p>}
      <div className="hand-groups">
        {groupByRank(hand).map(group => (
          <div key={group.rank} className="rank-group" role="group" aria-label={`${group.cards.length} ${rankPlural(group.rank)}`}>
            {group.cards.map(card => (
              <PlayingCard
                key={card.suit}
                card={card}
                animKey={cardKey(card)}
                selected={group.rank === rank}
                drawn={drawnKeys.includes(cardKey(card))}
                onClick={onPickRank && (() => onPickRank(group.rank))}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
