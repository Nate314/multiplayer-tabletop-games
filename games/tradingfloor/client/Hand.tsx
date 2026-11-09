import { COMMODITIES } from '../cards.ts';
import CardFace from './CardFace';
import { cardLabel } from './describeMove.ts';
import type { Card } from '../types.ts';

const ORDER: Card['kind'][] = [...COMMODITIES.map(c => c.kind), 'bull', 'bear'];
const MAX_PICK = 4;

type HandProps = {
  cards: Card[];
  label: string;
  offering?: number[]; // shown raised
  picked?: number[];
  onToggle?: (id: number) => void; // left out, the hand is read only
};

// The cards grouped by commodity; while trading each card is a toggle button
export default function Hand({ cards, label, offering = [], picked = [], onToggle }: HandProps) {
  const groups = ORDER.map(kind => cards.filter(card => card.kind === kind)).filter(group => group.length > 0);
  const full = picked.length >= MAX_PICK;
  return (
    <section className="tf-hand" aria-label={label}>
      <header className="tf-heading">{label}</header>
      {groups.length === 0 ? <p className="tf-empty">No cards</p> : (
        <div className="tf-groups">
          {groups.map(group => (
            <div key={group[0].kind} className="tf-group">
              {group.map(card => {
                const className = offering.includes(card.id) ? 'tf-hand-card tf-offered' : 'tf-hand-card';
                const on = picked.includes(card.id);
                return onToggle ? (
                  <button key={card.id} type="button" className={className} aria-label={cardLabel(card.kind)} aria-pressed={on}
                    disabled={full && !on} onClick={() => onToggle(card.id)}>
                    <CardFace kind={card.kind} />
                  </button>
                ) : (
                  <span key={card.id} className={className} title={cardLabel(card.kind)}><CardFace kind={card.kind} /></span>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
