import { useState } from 'react';
import { BOARD, mortgageInterest, unmortgageCost } from '../board.ts';
import type { MortgageDecision, Move } from '../types.ts';

type MortgageChoiceProps = {
  decision: MortgageDecision;
  cash: number;
  onMove: (move: Move) => void;
};

// For each mortgaged property just received: lift the mortgage now for its value plus 10%, or keep it for the 10%
export default function MortgageChoice({ decision, cash, onMove }: MortgageChoiceProps) {
  const [lift, setLift] = useState<number[]>([]);
  const toggle = (space: number) => setLift(current => current.includes(space) ? current.filter(other => other !== space) : [...current, space]);
  const cost = decision.spaces.reduce((sum, space) => sum + (lift.includes(space) ? unmortgageCost(space) : mortgageInterest(space)), 0);
  const affordable = lift.length === 0 || cost <= cash;

  return (
    <div className="mortgage-choice">
      <p className="turn-note">
        You received mortgaged property. Lift each mortgage now for its value plus 10%, or keep it mortgaged for 10% now
        (lifting it later costs the value plus 10% again).
      </p>
      {decision.spaces.map(space => (
        <label key={space} className="trade-property">
          <input type="checkbox" checked={lift.includes(space)} onChange={() => toggle(space)} />
          Lift {BOARD[space].name} now for ${unmortgageCost(space)} (keeping it costs ${mortgageInterest(space)})
        </label>
      ))}
      <div className="turn-buttons">
        <button type="button" className="primary" disabled={!affordable} title={affordable ? undefined : 'You do not have that much cash'}
          onClick={() => onMove({ type: 'liftMortgages', spaces: lift })}>
          Pay ${cost}
        </button>
      </div>
    </div>
  );
}
