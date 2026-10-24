import CardView from './CardView';
import { cardKey } from './animKeys.ts';
import type { Card } from '../types.ts';

type HandProps = {
  cards: Card[];
  label: string;
  // On your turn a card can be picked; `picked` is its index in the hand as the server holds it
  picked?: number | null;
  onPick?: (index: number) => void;
  // Ids of the cards to outline as newly drawn
  drawnIds?: number[];
};

const order = (card: Card) => (card.kind === 'skipbo' ? 13 : card.value);

// The hand shown low to high with Skip-Bo cards last; each card keeps its index in the server's hand for the move
export default function Hand({ cards, label, picked = null, onPick, drawnIds = [] }: HandProps) {
  const shown = cards.map((card, index) => ({ card, index })).sort((a, b) => order(a.card) - order(b.card));
  return (
    <section className="my-hand" aria-label={label}>
      <header className="my-hand-header">{label}</header>
      <div className="hand-cards">
        {shown.length === 0 && <span className="hand-empty">No cards</span>}
        {shown.map(({ card, index }) => onPick
          ? <CardView key={cardKey(card)} card={card} selected={picked === index} drawn={drawnIds.includes(card.id)} onClick={() => onPick(index)} />
          : <CardView key={cardKey(card)} card={card} drawn={drawnIds.includes(card.id)} />)}
      </div>
    </section>
  );
}
