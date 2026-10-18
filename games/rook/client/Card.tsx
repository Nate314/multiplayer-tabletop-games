import { cardName, cardPoints } from '../rules.ts';
import type { Card as CardData } from '../types.ts';

type CardProps = {
  card: CardData | null; // null draws a face-down card
  animKey?: string;
  playable?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  small?: boolean;
  // Given only where the card can be picked; without it the card is not a button
  onClick?: () => void;
};

// One Rook card: its number in the corners and the middle, its color, and its counter value if it has one
export default function Card({ card, animKey, playable = false, selected = false, highlighted = false, small = false, onClick }: CardProps) {
  const classes = ['rook-card', card ? `rook-card-${card.color}` : 'rook-card-back'];
  if (small) classes.push('rook-card-small');
  if (playable) classes.push('rook-card-playable');
  if (selected) classes.push('rook-card-selected');
  if (highlighted) classes.push('rook-card-highlighted');
  const label = card ? cardName(card) : 'face-down card';
  const points = card ? cardPoints(card) : 0;
  const mark = card === null ? '' : card.color === 'rook' ? 'R' : String(card.number);
  const face = card && (
    <>
      <span className="rook-card-corner">{mark}</span>
      <span className="rook-card-middle">{card.color === 'rook' ? <span aria-hidden="true">🐦</span> : card.number}</span>
      {points > 0 && <span className="rook-card-points">{points}</span>}
    </>
  );

  if (!onClick) {
    return <span className={classes.join(' ')} title={label} aria-label={label} role="img" data-anim-key={animKey}>{face}</span>;
  }
  return (
    <button type="button" className={classes.join(' ')} title={label} aria-label={label} aria-pressed={selected}
      data-anim-key={animKey} disabled={!playable} onClick={onClick}>
      {face}
    </button>
  );
}
