import { Die } from '../../../src/components/Dice';
import type { PublicGameState } from '../types.ts';

type RollPanelProps = {
  gameState: PublicGameState;
  canRoll: boolean;
  onRoll: () => void;
  autoRoll: boolean;
  onAutoRoll: (on: boolean) => void;
};

// The last roll, the Roll button, which only the player on turn can press, and this tab's Auto-roll
export default function RollPanel({ gameState, canRoll, onRoll, autoRoll, onAutoRoll }: RollPanelProps) {
  const { lastMove, playerNames } = gameState;
  return (
    <div className="sl-roll-panel">
      <div className="sl-last-roll">
        {lastMove ? (
          <>
            <Die value={lastMove.roll} className="sl-die" label={`Last roll: ${lastMove.roll}`} />
            <span className="sl-roller">{playerNames[lastMove.playerNumber]}'s roll</span>
          </>
        ) : (
          <span className="sl-roller">No roll yet</span>
        )}
      </div>
      <button type="button" className="sl-button sl-roll-button" onClick={onRoll} disabled={!canRoll}>
        Roll
      </button>
      <label className="sl-auto-roll">
        <input type="checkbox" checked={autoRoll} onChange={event => onAutoRoll(event.target.checked)} />
        Auto-roll
      </label>
    </div>
  );
}
