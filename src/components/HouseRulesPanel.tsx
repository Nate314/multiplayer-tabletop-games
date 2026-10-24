import gameService from '../services/gameService';
import { houseRulesOf, type HouseRuleValue, type HouseRulesProposal } from '../../shared/houseRules.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type HouseRulesPanelProps = {
  game: GameInfo;
  gameState: BasePublicState;
  playerNumber: Seat;
};

// Before the first move: the host edits the rules, everyone agrees to the current revision
export default function HouseRulesPanel({ game, gameState, playerNumber }: HouseRulesPanelProps) {
  const rules = houseRulesOf(game, gameState);
  const { playerNames, activePlayers } = gameState;
  const isHost = rules.host === playerNumber;
  const stretched = game.stretchedPlayers;
  const seated = activePlayers.length;

  const propose = (change: Partial<HouseRulesProposal>) => {
    gameService.setHouseRules({ values: rules.values, override: rules.override, maxPlayers: rules.maxPlayers, ...change });
  };
  const setValue = (id: string, value: HouseRuleValue) => propose({ values: { ...rules.values, [id]: value } });

  return (
    <div className="house-rules-panel">
      <div className="house-rules-title">House rules</div>
      <div className="house-rules-host">
        {rules.host === null ? '' : isHost ? 'You set the house rules' : `${playerNames[rules.host]} sets the house rules`}
      </div>
      {(game.houseRules ?? []).filter(rule => rule.id in rules.values).map(rule => (
        <div key={rule.id} className="house-rules-rule">
          <label>
            {rule.kind === 'toggle' ? (
              <input type="checkbox" checked={rules.values[rule.id] === true} disabled={!isHost}
                onChange={(e) => setValue(rule.id, e.target.checked)} />
            ) : (
              <select value={String(rules.values[rule.id])} disabled={!isHost}
                onChange={(e) => setValue(rule.id, rule.choices.find(choice => String(choice.value) === e.target.value)!.value)}>
                {rule.choices.map(choice => <option key={String(choice.value)} value={String(choice.value)}>{choice.label}</option>)}
              </select>
            )}
            {rule.label}
          </label>
          {rule.help && <div className="house-rules-help">{rule.help}</div>}
        </div>
      ))}
      {stretched && (
        <div className="house-rules-rule">
          <label>
            <input type="checkbox" checked={rules.override} disabled={!isHost}
              onChange={(e) => propose({ override: e.target.checked, maxPlayers: e.target.checked ? Math.max(seated, stretched.min, game.maxPlayers) : null })} />
            I know what I'm doing
          </label>
          {rules.override && (
            <label>
              Most players
              <input type="number" min={Math.max(seated, stretched.min)} max={stretched.max} disabled={!isHost}
                value={rules.maxPlayers ?? ''}
                onChange={(e) => { if (e.target.value !== '') propose({ maxPlayers: Number(e.target.value) }); }} />
            </label>
          )}
        </div>
      )}
      <ul className="house-rules-list">
        {activePlayers.map(seat => (
          <li key={seat} className="house-rules-agreed">
            {`${playerNames[seat]}: ${rules.agreed.includes(seat) ? 'agreed' : 'waiting'}`}
          </li>
        ))}
      </ul>
      {!rules.agreed.includes(playerNumber) && (
        <div className="house-rules-actions">
          <button type="button" className="primary-button" onClick={() => gameService.agreeHouseRules(rules.revision)}>Agree</button>
        </div>
      )}
    </div>
  );
}
