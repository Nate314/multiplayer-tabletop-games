import { territoryName } from '../map.ts';
import type { Battle, PublicGameState } from '../types.ts';

// Pip positions on a 3 by 3 grid, numbered 0-8 from the top left
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

function Die({ value, side }: { value: number; side: 'attack' | 'defend' }) {
  return (
    <div className={`die die-${side}`} role="img" aria-label={String(value)}>
      {Array.from({ length: 9 }, (_, spot) => <span key={spot} className={PIPS[value]?.includes(spot) ? 'pip' : ''} />)}
    </div>
  );
}

// The last battle: the attacker's red dice against the defender's white ones, and what each side lost
export default function BattleDice({ battle, playerNames }: { battle: Battle | null; playerNames: PublicGameState['playerNames'] }) {
  if (!battle) return null;
  const defender = battle.defender === null ? 'Neutral' : playerNames[battle.defender];
  return (
    <section className="panel battle" aria-label="Last battle">
      <div className="panel-title">
        {territoryName(battle.from)} attacked {territoryName(battle.to)}
        {battle.rolls > 1 && <span className="battle-rolls"> (blitz, {battle.rolls} rolls, last roll shown)</span>}
      </div>
      <div className="battle-sides">
        <div className="battle-side">
          <span className="battle-who">{playerNames[battle.attacker]}</span>
          <div className="dice">{battle.attackDice.map((value, index) => <Die key={index} value={value} side="attack" />)}</div>
          <span className="battle-lost">lost {battle.attackerLost}</span>
        </div>
        <div className="battle-side">
          <span className="battle-who">{defender}</span>
          <div className="dice">{battle.defendDice.map((value, index) => <Die key={index} value={value} side="defend" />)}</div>
          <span className="battle-lost">lost {battle.defenderLost}</span>
        </div>
      </div>
      {battle.conquered && <div className="battle-result">{territoryName(battle.to)} was captured</div>}
    </section>
  );
}
