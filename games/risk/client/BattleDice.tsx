import { Die } from '../../../src/components/Dice';
import { territoryName } from '../map.ts';
import type { Battle, PublicGameState } from '../types.ts';

// The last battle: the attacker's red dice against the defender's white ones, and what each side lost
export default function BattleDice({ battle, playerNames }: { battle: Battle | null; playerNames: PublicGameState['playerNames'] }) {
  if (!battle) return null;
  const defender = battle.defender === null ? 'Neutral' : playerNames[battle.defender];
  return (
    <section className="panel battle hand-only-hide" aria-label="Last battle">
      <div className="panel-title">
        {territoryName(battle.from)} attacked {territoryName(battle.to)}
        {battle.rolls > 1 && <span className="battle-rolls"> (blitz, {battle.rolls} rolls, last roll shown)</span>}
      </div>
      <div className="battle-sides">
        <div className="battle-side">
          <span className="battle-who">{playerNames[battle.attacker]}</span>
          <div className="dice">{battle.attackDice.map((value, index) => <Die key={index} value={value} className="die die-attack" label={String(value)} />)}</div>
          <span className="battle-lost">lost {battle.attackerLost}</span>
        </div>
        <div className="battle-side">
          <span className="battle-who">{defender}</span>
          <div className="dice">{battle.defendDice.map((value, index) => <Die key={index} value={value} className="die die-defend" label={String(value)} />)}</div>
          <span className="battle-lost">lost {battle.defenderLost}</span>
        </div>
      </div>
      {battle.conquered && <div className="battle-result">{territoryName(battle.to)} was captured</div>}
    </section>
  );
}
