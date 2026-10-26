import { useCountdown, formatClock } from '../../../src/hooks/useCountdown.ts';
import useTimerWarning from '../../../src/sound/useTimerWarning.ts';
import { phaseDeadline } from '../clock.ts';
import type { PublicGameState, Seat } from '../types.ts';

type GameStatusProps = {
  gameState: PublicGameState;
  playerNumber: Seat;
  error: string | null;
};

function turnMessage(state: PublicGameState, playerNumber: Seat): string {
  const { drawer, playerNames, activePlayers, phase, word, isGameOver } = state;
  const name = drawer === null ? '' : playerNames[drawer];
  const mine = drawer === playerNumber;
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  if (phase === 'choosing') return mine ? 'Choose a word to draw' : `${name} is choosing a word`;
  if (phase === 'drawing') return mine ? `Draw ${word}` : `${name} is drawing`;
  return `The word was ${word}`;
}

export default function GameStatus({ gameState, playerNumber, error }: GameStatusProps) {
  const { gameStatus, drawer, phase, guessed, isGameOver } = gameState;
  const timeLeft = useCountdown(phaseDeadline(gameState), gameState.serverTime);
  // The clock matters to the drawer, and to a guesser until they get the word
  const racing = drawer === playerNumber ? phase !== 'reveal' : phase === 'drawing' && !guessed.includes(playerNumber);
  useTimerWarning(timeLeft, racing && !isGameOver);

  return (
    <>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>
          {error || gameStatus}
        </div>
      )}
      <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
      {timeLeft !== null && (
        <div className="turn-timer" role="timer" aria-label="Time left">{formatClock(timeLeft)}</div>
      )}
    </>
  );
}
