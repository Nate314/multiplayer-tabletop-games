import { describeHouseRules, houseRulesOf, needsAgreement } from '../../shared/houseRules.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState } from '../../shared/types.ts';

type HouseRulesSectionProps = {
  game: GameInfo;
  gameState: BasePublicState;
};

// The Settings dialog's read-only list of the current game's house rules, for every player all game, with each
// non-standard value marked. A game with no house rule options shows nothing
export default function HouseRulesSection({ game, gameState }: HouseRulesSectionProps) {
  if (!needsAgreement(game)) return null;
  const lines = describeHouseRules(game, houseRulesOf(game, gameState));

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
