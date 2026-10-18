import CardView from './CardView';
import { buildGroup, phaseRequirements, requirementName } from '../rules.ts';
import type { Card, Seat } from '../types.ts';

type LayDownPanelProps = {
  seat: Seat;
  phase: number;
  staged: Card[][]; // the cards put in each part of the phase so far
  hasSelection: boolean;
  onAdd: (part: number) => void;
  onReturn: (card: Card) => void;
  onClear: () => void;
  onLayDown: () => void;
};

// Building your phase: put selected cards into each part, then lay it down once every part is right
export default function LayDownPanel({ seat, phase, staged, hasSelection, onAdd, onReturn, onClear, onLayDown }: LayDownPanelProps) {
  const requirements = phaseRequirements(phase);
  const valid = requirements.every((requirement, part) => buildGroup(seat, requirement, staged[part] ?? []) !== null);
  const anyStaged = staged.some(cards => cards.length > 0);

  return (
    <div className="lay-down">
      <div className="lay-down-title">Lay down phase {phase}</div>
      <div className="lay-down-parts">
        {requirements.map((requirement, part) => {
          const cards = staged[part] ?? [];
          return (
            <div key={part} className="lay-down-part">
              <div className="group-label">
                Group {part + 1}: {requirementName(requirement)} ({cards.length}/{requirement.size})
              </div>
              <div className="group-cards">
                {cards.map(card => (
                  <CardView key={card.id} card={card} small onClick={() => onReturn(card)} />
                ))}
              </div>
              <button type="button" disabled={!hasSelection} onClick={() => onAdd(part)}>
                Add selected to group {part + 1}
              </button>
            </div>
          );
        })}
      </div>
      <div className="lay-down-actions">
        <button type="button" disabled={!valid} onClick={onLayDown}>Lay down phase</button>
        <button type="button" disabled={!anyStaged} onClick={onClear}>Clear</button>
      </div>
    </div>
  );
}
