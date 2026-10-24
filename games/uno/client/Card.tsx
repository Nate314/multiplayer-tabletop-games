import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import { cardName } from '../rules.ts';
import type { Card as CardData, Value } from '../types.ts';

// The mark in the middle of each card; numbers show themselves
const SYMBOLS: Partial<Record<Value, string>> = {
  skip: '⊘',
  reverse: '⇄',
  drawTwo: '+2',
  wild: 'W',
  wildDrawFour: '+4'
};

type CardProps = {
  card: CardData;
  animKey?: string; // for move animations
  highlighted?: boolean; // the card the last move played, in the history dialog
  // Given only for a card in your hand on your turn; without it the card is not a button
  onClick?: () => void;
  playable?: boolean;
  selected?: boolean;
  drawn?: boolean; // outlined as a card you just drew
};

export default function Card({ card, animKey, highlighted = false, onClick, playable = false, selected = false, drawn = false }: CardProps) {
  const classes = ['card', `card-${card.color}`];
  if (highlighted) classes.push('card-highlighted');
  if (selected) classes.push('card-selected');
  if (drawn) classes.push('newly-drawn');
  const face = (
    <>
      <ColorSymbol color={card.color === 'wild' ? null : card.color} className="card-symbol" />
      <span className="card-face">{SYMBOLS[card.value] ?? card.value}</span>
    </>
  );

  if (!onClick) {
    return <span className={classes.join(' ')} title={cardName(card)} data-anim-key={animKey}>{face}</span>;
  }
  classes.push(playable ? 'card-playable' : 'card-unplayable');
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-label={cardName(card)}
      title={cardName(card)}
      data-anim-key={animKey}
      disabled={!playable}
      onClick={onClick}
    >
      {face}
    </button>
  );
}
