import { useState } from 'react';
import gameService from '../services/gameService';
import { houseRulesOf, type HouseRuleValue, type HouseRulesProposal } from '../../shared/houseRules.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type HouseRulesPanelProps = {
  game: GameInfo;
  gameState: BasePublicState;
  playerNumber: Seat;
  error?: string | null; // the last refusal from the server, such as a stale agreement
};

// A typed number is kept as a draft and sent once it is a whole number in range, on Enter or leaving the field.
// The parent remounts it (by key) when the server's value changes, which resets the draft.
function MostPlayersField({ value, min, max, disabled, onCommit }: {
  value: number | null; min: number; max: number; disabled: boolean; onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const commit = () => {
    const typed = Number(draft);
    if (draft.trim() !== '' && Number.isInteger(typed) && typed >= min && typed <= max) {
      if (typed !== value) onCommit(typed);
    } else {
      setDraft(value === null ? '' : String(value));
    }
  };
  return (
    <span>
      <label htmlFor="house-rules-most-players">Most players</label>
      <input id="house-rules-most-players" type="number" min={min} max={max} disabled={disabled} value={draft}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
    </span>
  );
}

// Before the first move: the host edits the rules, everyone agrees to the current revision
export default function HouseRulesPanel({ game, gameState, playerNumber, error }: HouseRulesPanelProps) {
  const rules = houseRulesOf(game, gameState);
  const { playerNames, activePlayers } = gameState;
  const isHost = rules.host === playerNumber;
  const stretched = game.stretchedPlayers;
  const seated = activePlayers.length;

  // Only the changed rule is sent: the server keeps the others, and drops a rule that the change no longer offers
  // (Chess "Increment per move" once the clock is off), which it would refuse if it were sent back
  const propose = (change: Partial<HouseRulesProposal>) => {
    gameService.setHouseRules({ values: {}, override: rules.override, maxPlayers: rules.maxPlayers, ...change });
  };
  const setValue = (id: string, value: HouseRuleValue) => propose({ values: { [id]: value } });

  return (
    <div className="house-rules-panel">
      <div className="house-rules-title">House rules</div>
      {rules.host !== null && (
        <div className="house-rules-host">
          {isHost ? 'You set the house rules' : `${playerNames[rules.host]} sets the house rules`}
        </div>
      )}
      {(game.houseRules ?? []).filter(rule => rule.id in rules.values).map(rule => (
        <div key={rule.id} className="house-rules-rule">
          {/* The label sits beside its control, so the control's own text never becomes part of the label */}
          <span>
            {rule.kind === 'toggle' ? (
              <input id={`house-rule-${rule.id}`} type="checkbox" checked={rules.values[rule.id] === true} disabled={!isHost}
                onChange={(e) => setValue(rule.id, e.target.checked)} />
            ) : (
              <select id={`house-rule-${rule.id}`} value={String(rules.values[rule.id])} disabled={!isHost}
                onChange={(e) => setValue(rule.id, rule.choices.find(choice => String(choice.value) === e.target.value)!.value)}>
                {rule.choices.map(choice => <option key={String(choice.value)} value={String(choice.value)}>{choice.label}</option>)}
              </select>
            )}
            <label htmlFor={`house-rule-${rule.id}`}>{rule.label}</label>
          </span>
          {rule.help && <div className="house-rules-help">{rule.help}</div>}
        </div>
      ))}
      {stretched && (
        <div className="house-rules-rule">
          <span>
            <input id="house-rules-override" type="checkbox" checked={rules.override} disabled={!isHost}
              onChange={(e) => propose({ override: e.target.checked, maxPlayers: e.target.checked ? Math.max(seated, stretched.min, game.maxPlayers) : null })} />
            <label htmlFor="house-rules-override">I know what I'm doing</label>
          </span>
          {rules.override && (
            <MostPlayersField key={rules.maxPlayers} value={rules.maxPlayers} disabled={!isHost}
              min={Math.max(seated, stretched.min)} max={stretched.max}
              onCommit={(maxPlayers) => propose({ maxPlayers })} />
          )}
        </div>
      )}
      <ul className="house-rules-list">
        {activePlayers.map(seat => (
          <li key={seat} className={rules.agreed.includes(seat) ? 'house-rules-agreed' : undefined}
            aria-current={seat === playerNumber ? 'true' : undefined}>
            {`${playerNames[seat]}: ${rules.agreed.includes(seat) ? 'agreed' : 'waiting'}`}
          </li>
        ))}
      </ul>
      {error && <div className="house-rules-error" role="alert">{error}</div>}
      {!rules.agreed.includes(playerNumber) && (
        <div className="house-rules-actions">
          <button type="button" className="primary-button" onClick={() => gameService.agreeHouseRules(rules.revision)}>Agree</button>
        </div>
      )}
    </div>
  );
}
