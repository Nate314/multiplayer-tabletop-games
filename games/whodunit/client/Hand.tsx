import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import usePreloadSvgs from '../../../src/assets/usePreloadSvgs.ts';
import { svgUrl } from '../../../src/assets/svgCache.ts';
import { CARDS, kindOf, nameOf } from '../content.ts';
import type { CardId } from '../content.ts';

const CARD_PIECES = CARDS.map(card => svgUrl('whodunit-card', card));

// One card face: its drawing over its name, colored by kind
export function Card({ card }: { card: CardId }) {
  usePreloadSvgs(CARD_PIECES);
  return (
    <span className={`wd-card wd-card-${kindOf(card)}`}>
      <ServerSvg url={svgUrl('whodunit-card', card)} className="wd-card-art" />
      <span className="wd-card-name">{nameOf(card)}</span>
    </span>
  );
}

// A labelled row of cards: the viewer's hand, or a dismissed player's cards turned face up
export default function Hand({ cards, label }: { cards: CardId[]; label: string }) {
  return (
    <section className="wd-hand" aria-label={label}>
      <h3 className="wd-heading">{label}</h3>
      <div className="wd-hand-cards">
        {cards.map(card => <Card key={card} card={card} />)}
      </div>
    </section>
  );
}
