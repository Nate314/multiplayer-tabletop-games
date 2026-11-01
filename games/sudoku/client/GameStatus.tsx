import YouTag from '../../../src/components/YouTag.tsx';
import { MODE_RULE } from '../../../shared/puzzleModes.ts';
import { DIFFICULTY } from '../options.ts';
import { modeOfState } from './shown.ts';
import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  error: string | null;
};

const labelOf = (choices: { value: string; label: string }[], value: string) => choices.find(c => c.value === value)?.label ?? value;

// The status line, the mode and difficulty, and in Together who is playing
export default function GameStatus({ gameState, playerNumber, error }: GameStatusProps) {
  const { gameStatus, playerNames, activePlayers, difficulty } = gameState;
  const mode = modeOfState(gameState);
  const seats = Object.keys(playerNames).map(Number).sort((a, b) => a - b);

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className="sudoku-mode">{`${labelOf(MODE_RULE.choices, mode)}, ${labelOf(DIFFICULTY.choices, difficulty)}`}</div>
      {mode === 'together' && (
        <ul className="player-list">
          {seats.map(seat => (
            <li key={seat} className={activePlayers.includes(seat) ? '' : 'player-left'}>
              {playerNames[seat]}<YouTag when={seat === playerNumber} />
              {!activePlayers.includes(seat) && ' (left)'}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
