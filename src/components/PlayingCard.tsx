import ServerSvg from '../assets/ServerSvg.tsx';
import usePreloadSvgs from '../assets/usePreloadSvgs.ts';
import { DECK_PIECES, cardUrl } from './pieces.ts';
import { cardName, isJoker } from '../../shared/playingCards.ts';
import type { DeckCard } from '../../shared/playingCards.ts';

type PlayingCardProps = {
  card: DeckCard | null; // null draws the back of a face-down card
  size?: 'small' | 'medium' | 'large';
  animKey?: string; // for move animations
  highlighted?: boolean;
  selected?: boolean;
  drawn?: boolean; // outlined as a card you just drew
  // Given only for a card the player can pick; without it the card is not a button
  onClick?: () => void;
  disabled?: boolean;
};

// A standard playing card, shared by the games that use the 52-card deck
export default function PlayingCard({ card, size = 'medium', animKey, highlighted = false, selected = false, drawn = false, onClick, disabled = false }: PlayingCardProps) {
  usePreloadSvgs(DECK_PIECES); // the whole deck, so a card dealt or turned later is already drawn
  const classes = ['playing-card', `playing-card-${size}`];
  if (!card) classes.push('playing-card-back');
  else if (isJoker(card)) classes.push('playing-card-joker');
  else if (card.suit === 'hearts' || card.suit === 'diamonds') classes.push('playing-card-red');
  if (highlighted) classes.push('playing-card-highlighted');
  if (selected) classes.push('playing-card-selected');
  if (drawn) classes.push('newly-drawn');
  const label = card ? cardName(card) : 'face-down card';
  // The marks are drawn by the server (shared/svg/playingCards.ts); the face color and outlines stay here
  const face = <ServerSvg url={cardUrl(card)} />;

  if (!onClick) {
    return <span className={classes.join(' ')} title={label} aria-label={label} role="img" data-anim-key={animKey}>{face}</span>;
  }
  return (
    <button type="button" className={classes.join(' ')} aria-label={label} title={label}
      aria-pressed={selected} data-anim-key={animKey} disabled={disabled} onClick={onClick}>
      {face}
    </button>
  );
}
