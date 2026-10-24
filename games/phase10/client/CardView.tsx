import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { cardName } from '../rules.ts';
import type { Card } from '../types.ts';

type CardViewProps = {
  card: Card;
  // What a wild stands for in a run, shown under its W
  standsFor?: number | null;
  selected?: boolean;
  small?: boolean;
  // Makes the card a button, for picking cards in your own hand
  onClick?: () => void;
  disabled?: boolean;
};

function face(card: Card): string {
  if (card.kind === 'wild') return 'W';
  if (card.kind === 'skip') return 'S';
  return String(card.value);
}

export default function CardView({ card, standsFor = null, selected = false, small = false, onClick, disabled = false }: CardViewProps) {
  const classes = ['card', `card-${card.kind === 'number' ? card.color : card.kind}`];
  if (selected) classes.push('card-selected');
  if (small) classes.push('card-small');
  const content = (
    <>
      {card.kind === 'number' && <ColorSymbol color={card.color} className="card-symbol" />}
      <span className="card-face">{face(card)}</span>
      {standsFor !== null && card.kind === 'wild' && <span className="card-stands-for">{standsFor}</span>}
    </>
  );
  const label = cardName(card);

  if (!onClick) return <span className={classes.join(' ')} aria-label={label}>{content}</span>;
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
