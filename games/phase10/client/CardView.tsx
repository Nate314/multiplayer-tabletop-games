import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { cardFace, cardName } from '../rules.ts';
import type { Card } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { cardArt } from './animateMove.ts';

type CardViewProps = {
  card: Card;
  // What a wild stands for in a run, shown under its W
  standsFor?: number | null;
  selected?: boolean;
  small?: boolean;
  // Makes the card a button, for picking cards in your own hand
  onClick?: () => void;
  disabled?: boolean;
  // Where moves slide this card from or to
  animKey?: string;
  // Outlined as a card you just drew
  drawn?: boolean;
};

export default function CardView({ card, standsFor = null, selected = false, small = false, onClick, disabled = false, animKey, drawn = false }: CardViewProps) {
  const classes = ['card', `card-${card.kind === 'number' ? card.color : card.kind}`];
  if (selected) classes.push('card-selected');
  if (small) classes.push('card-small');
  if (drawn) classes.push('newly-drawn');
  const content = (
    <>
      <ServerSvg url={cardArt(card)} className="piece-art" />
      {card.kind === 'number' && <ColorSymbol color={card.color} className="card-symbol" />}
      <span className="card-face">{cardFace(card)}</span>
      {standsFor !== null && card.kind === 'wild' && <span className="card-stands-for">{standsFor}</span>}
    </>
  );
  const label = cardName(card);

  if (!onClick) return <span className={classes.join(' ')} aria-label={label} data-anim-key={animKey}>{content}</span>;
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-label={label}
      data-anim-key={animKey}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
