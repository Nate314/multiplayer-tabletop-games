import { describeHouseRules, houseRulesOf } from '../../shared/houseRules.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState } from '../../shared/types.ts';

type HouseRulesSectionProps = {
  game: GameInfo;
  gameState: BasePublicState;
};

// The Settings dialog's read-only list of the current game's house rules, for every player all game, with each
// non-standard value marked.
export default function HouseRulesSection({ game, gameState }: HouseRulesSectionProps) {
  const lines = describeHouseRules(game, houseRulesOf(game, gameState), gameState.activePlayers.length);

  return (
    <section className="settings-house-rules" aria-label="House rules">
      <h3>House rules</h3>
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
