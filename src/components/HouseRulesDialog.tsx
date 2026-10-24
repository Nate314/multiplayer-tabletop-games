import useEscapeKey from '../hooks/useEscapeKey';
import { describeHouseRules, type HouseRulesState } from '../../shared/houseRules.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';

type HouseRulesDialogProps = {
  game: GameInfo;
  rules: HouseRulesState;
  onClose: () => void;
};

export default function HouseRulesDialog({ game, rules, onClose }: HouseRulesDialogProps) {
  useEscapeKey(onClose);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal house-rules" role="dialog" aria-label="House rules" onClick={(e) => e.stopPropagation()}>
        <h2>House rules</h2>
        <dl>
          {describeHouseRules(game, rules).map(({ label, value, standard }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{standard ? value : `${value} (house rule)`}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="primary-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
