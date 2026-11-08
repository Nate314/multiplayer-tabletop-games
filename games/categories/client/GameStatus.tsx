import { useCountdown, formatClock } from '../../../src/hooks/useCountdown.ts';
import useTimerWarning from '../../../src/sound/useTimerWarning.ts';
import { houseRule } from '../../../shared/houseRules.ts';
import { phaseDeadline } from '../clock.ts';
import { ROUNDS } from '../options.ts';
import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  error: string | null;
};

export default function GameStatus({ gameState, playerNumber, error }: GameStatusProps) {
  const { gameStatus, letter, round, phase, done, isGameOver, activePlayers, playerNames } = gameState;
  const timeLeft = useCountdown(phaseDeadline(gameState), gameState.serverTime);
  useTimerWarning(timeLeft, phase === 'answering' && !done.includes(playerNumber) && !isGameOver);
  const doneNames = done.filter(seat => activePlayers.includes(seat)).map(seat => playerNames[seat]);

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
      )}
      {isGameOver ? <div className="turn-message">Game over</div> : letter && (
        <div className="categories-top">
          <span className="categories-letter" aria-label={`Letter ${letter}`}>{letter}</span>
          <div>
            <div className="turn-message">Round {round} of {houseRule(gameState, ROUNDS)}</div>
            {timeLeft !== null && <div className="turn-timer" role="timer" aria-label="Time left">{formatClock(timeLeft)}</div>}
          </div>
        </div>
      )}
      {phase === 'answering' && doneNames.length > 0 && <div className="categories-done">Done: {doneNames.join(', ')}</div>}
    </>
  );
}
