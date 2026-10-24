// The small pieces every Splendor view draws: gem tokens, development cards and nobles
import ColorSymbol from '../../../src/components/ColorSymbol.tsx';
import type { SymbolColor } from '../../../src/components/colorSymbols.ts';
import { CARDS, GEMS, NOBLES } from '../cards.ts';
import type { Gems, Level, Token } from '../types.ts';

// Gold is shown as the yellow shape
const symbolOf = (token: Token): SymbolColor => (token === 'gold' ? 'yellow' : token);

type GemTokenProps = {
  token: Token;
  count?: number;
  animKey?: string;
  size?: 'small' | 'large';
  selected?: number;          // how many of this color are picked
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
};

// A round token; with a count it shows how many there are
export function GemToken({ token, count, animKey, size = 'small', selected = 0, onClick, disabled, label }: GemTokenProps) {
  const className = `gem gem-${token} gem-${size}${selected > 0 ? ' gem-selected' : ''}`;
  const name = label ?? (count === undefined ? token : `${count} ${token}`);
  const content = (
    <>
      <ColorSymbol color={symbolOf(token)} />
      {count !== undefined && <span className="gem-count">{count}</span>}
      {selected > 0 && <span className="gem-picked" aria-hidden="true">{selected}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={className} data-anim-key={animKey} onClick={onClick} disabled={disabled} aria-label={name} aria-pressed={selected > 0}>
        {content}
      </button>
    );
  }
  return <span className={className} data-anim-key={animKey} title={name} role="img" aria-label={name}>{content}</span>;
}

// A cost as one small pip per color with a number, in white, blue, green, red, black order
export function Cost({ cost }: { cost: Gems }) {
  return (
    <span className="cost">
      {GEMS.filter(gem => cost[gem] > 0).map(gem => (
        <span key={gem} className={`cost-pip gem-${gem}`} title={`${cost[gem]} ${gem}`}><ColorSymbol color={gem} />{cost[gem]}</span>
      ))}
    </span>
  );
}

function cardLabel(id: number): string {
  const card = CARDS[id];
  const cost = GEMS.filter(gem => card.cost[gem] > 0).map(gem => `${card.cost[gem]} ${gem}`).join(', ');
  return `Level ${card.level} ${card.bonus} card, ${card.points} prestige, costs ${cost}`;
}

type CardViewProps = {
  card: number | null;       // null: a face-down card of `level`
  level: Level;
  animKey?: string;
  selected?: boolean;
  highlighted?: boolean;
  affordable?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

export function CardView({ card, level, animKey, selected, highlighted, affordable, onClick, disabled }: CardViewProps) {
  const classes = ['dev-card', `dev-card-level-${level}`];
  if (card === null) classes.push('dev-card-back');
  else classes.push(`dev-card-${CARDS[card].bonus}`);
  if (selected) classes.push('dev-card-selected');
  if (highlighted) classes.push('dev-card-highlighted');
  if (affordable) classes.push('dev-card-affordable');
  const label = card === null ? `Face-down level ${level} card` : cardLabel(card);
  const face = card === null
    ? <span className="dev-card-back-label">{'I'.repeat(level)}</span>
    : (
      <>
        <span className="dev-card-top">
          <span className="dev-card-points">{CARDS[card].points > 0 ? CARDS[card].points : ''}</span>
          <span className={`dev-card-bonus gem-${CARDS[card].bonus}`} aria-hidden="true"><ColorSymbol color={CARDS[card].bonus} /></span>
        </span>
        <Cost cost={CARDS[card].cost} />
      </>
    );
  const className = classes.join(' ');
  if (onClick) {
    return (
      <button type="button" className={className} data-anim-key={animKey} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={selected}>
        {face}
      </button>
    );
  }
  return <span className={className} data-anim-key={animKey} title={label} role="img" aria-label={label}>{face}</span>;
}

type NobleViewProps = { noble: number; animKey?: string; highlighted?: boolean; onClick?: () => void };

export function NobleView({ noble, animKey, highlighted, onClick }: NobleViewProps) {
  const { cost, points } = NOBLES[noble];
  const label = `Noble, ${points} prestige, needs ${GEMS.filter(gem => cost[gem] > 0).map(gem => `${cost[gem]} ${gem}`).join(', ')} bonuses`;
  const className = `noble${highlighted ? ' noble-highlighted' : ''}`;
  const face = (
    <>
      <span className="noble-points">{points}</span>
      <span className="noble-cost">
        {GEMS.filter(gem => cost[gem] > 0).map(gem => (
          <span key={gem} className={`noble-pip gem-${gem}`}><ColorSymbol color={gem} />{cost[gem]}</span>
        ))}
      </span>
    </>
  );
  if (onClick) {
    return <button type="button" className={className} data-anim-key={animKey} onClick={onClick} aria-label={`Choose: ${label}`}>{face}</button>;
  }
  return <span className={className} data-anim-key={animKey} title={label} role="img" aria-label={label}>{face}</span>;
}

