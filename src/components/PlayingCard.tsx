import { cardName, isJoker } from '../../shared/playingCards.ts';
import type { DeckCard, Suit } from '../../shared/playingCards.ts';

const SUIT_SYMBOLS: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };

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
  const classes = ['playing-card', `playing-card-${size}`];
  if (!card) classes.push('playing-card-back');
  else if (isJoker(card)) classes.push('playing-card-joker');
  else if (card.suit === 'hearts' || card.suit === 'diamonds') classes.push('playing-card-red');
  if (highlighted) classes.push('playing-card-highlighted');
  if (selected) classes.push('playing-card-selected');
  if (drawn) classes.push('newly-drawn');
  const label = card ? cardName(card) : 'face-down card';
  const face = card && (isJoker(card) ? (
    <>
      <span className="playing-card-corner">★</span>
      <span className="playing-card-pip">JOKER</span>
      <span className="playing-card-corner playing-card-corner-bottom">★</span>
    </>
  ) : (
    <>
      <span className="playing-card-corner">{card.rank}{SUIT_SYMBOLS[card.suit]}</span>
      <span className="playing-card-pip">{SUIT_SYMBOLS[card.suit]}</span>
      <span className="playing-card-corner playing-card-corner-bottom">{card.rank}{SUIT_SYMBOLS[card.suit]}</span>
    </>
  ));

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
