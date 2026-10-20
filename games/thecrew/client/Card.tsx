import { cardName } from '../rules.ts';
import type { Card as CardData } from '../types.ts';

type CardProps = {
  card: CardData;
  animKey?: string;
  playable?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  small?: boolean;
  // Given only where the card can be picked; without it the card is not a button
  onClick?: () => void;
};

// A letter per suit as well as its color, as the rulebook gives a symbol per color for players who cannot tell them apart
const MARK = { pink: 'P', blue: 'B', green: 'G', yellow: 'Y', rocket: '🚀' } as const;

// One Crew card: its value in the middle and its suit's mark in the corner
export default function Card({ card, animKey, playable = false, selected = false, highlighted = false, small = false, onClick }: CardProps) {
  const classes = ['crew-card', `crew-card-${card.suit}`];
  if (small) classes.push('crew-card-small');
  if (playable) classes.push('crew-card-playable');
  if (selected) classes.push('crew-card-selected');
  if (highlighted) classes.push('crew-card-highlighted');
  const label = cardName(card);
  const face = (
    <>
      <span className="crew-card-corner">{MARK[card.suit]}</span>
      <span className="crew-card-value">{card.value}</span>
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
