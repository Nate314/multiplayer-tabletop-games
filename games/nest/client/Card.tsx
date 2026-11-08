import { cardName, cardPoints } from '../rules.ts';
import type { Card as CardData } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { cardArtUrl } from '../../../src/components/pieces.ts';

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

// One Nest card: its number in the corners and the middle, its color, and its counter value if it has one
export default function Card({ card, animKey, playable = false, selected = false, highlighted = false, small = false, onClick }: CardProps) {
  const classes = ['nest-card', card ? (card.color === 'rook' ? 'nest-card-bird' : `nest-card-${card.color}`) : 'nest-card-back'];
  if (small) classes.push('nest-card-small');
  if (playable) classes.push('nest-card-playable');
  if (selected) classes.push('nest-card-selected');
  if (highlighted) classes.push('nest-card-highlighted');
  const label = card ? cardName(card) : 'face-down card';
  const points = card ? cardPoints(card) : 0;
  const mark = card === null ? '' : card.color === 'rook' ? 'B' : String(card.number);
  const art = <ServerSvg url={cardArtUrl(card === null ? 'stripes' : card.color === 'rook' ? 'bands' : 'solid')} className="piece-art" />;
  const face = card ? (
    <>
      {art}
      <span className="nest-card-corner">{mark}</span>
      <span className="nest-card-middle">{card.color === 'rook' ? <span className="nest-card-word">BIRD</span> : card.number}</span>
      {points > 0 && <span className="nest-card-points">{points}</span>}
    </>
  ) : art;

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
