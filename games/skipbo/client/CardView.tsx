import { cardName } from '../rules.ts';
import { cardKey } from './animKeys.ts';
import type { Card } from '../types.ts';
import ServerSvg from '../../../src/assets/ServerSvg.tsx';
import { cardArtUrl } from '../../../src/components/pieces.ts';

type CardViewProps = {
  card: Card;
  // What a Skip-Bo stands for on a building pile, shown under its name
  standsFor?: number | null;
  selected?: boolean;
  small?: boolean;
  // Makes the card a button, for picking the card to play
  onClick?: () => void;
  disabled?: boolean;
  // Outlined as a card you just drew
  drawn?: boolean;
};

// The real cards are blue for 1 to 4, green for 5 to 8 and red for 9 to 12
function band(card: Card): string {
  if (card.kind === 'skipbo') return 'skipbo';
  if (card.value <= 4) return 'low';
  return card.value <= 8 ? 'mid' : 'high';
}

export default function CardView({ card, standsFor = null, selected = false, small = false, onClick, disabled = false, drawn = false }: CardViewProps) {
  const classes = ['card', `card-${band(card)}`];
  if (selected) classes.push('card-selected');
  if (small) classes.push('card-small');
  if (drawn) classes.push('newly-drawn');
  const label = standsFor !== null && card.kind === 'skipbo' ? `Skip-Bo as ${standsFor}` : cardName(card);
  const content = (
    <>
      <ServerSvg url={cardArtUrl(card.kind === 'skipbo' ? 'bands' : 'solid')} className="piece-art" />
      {card.kind === 'skipbo'
        ? (
          <>
            <span className="card-face card-face-wild">SB</span>
            {standsFor !== null && <span className="card-stands-for">{standsFor}</span>}
          </>
        )
        : <span className="card-face">{card.value}</span>}
    </>
  );

  if (!onClick) return <span className={classes.join(' ')} aria-label={label} title={label} data-anim-key={cardKey(card)}>{content}</span>;
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      data-anim-key={cardKey(card)}
    >
      {content}
    </button>
  );
}
