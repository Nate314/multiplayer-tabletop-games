import { describeHouseRules, houseRulesOf } from '../../shared/houseRules.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState } from '../../shared/types.ts';

type HouseRulesSectionProps = {
  game: GameInfo;
  gameState: BasePublicState;
};

// The Rules dialog's read-only House rules tab once play starts (and for spectators): the list of the current game's house rules, for every player all game, with each
// non-standard value marked.
export default function HouseRulesSection({ game, gameState }: HouseRulesSectionProps) {
  const lines = describeHouseRules(game, houseRulesOf(game, gameState), gameState.activePlayers.length);

  return (
    <section className="house-rules-summary" aria-label="House rules">
      {lines.length === 0 ? <p>Standard rules</p> : (
        <dl>
          {lines.map(({ label, value, standard }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{standard ? value : `${value} (house rule)`}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
