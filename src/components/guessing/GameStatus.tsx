import { useCountdown, formatClock } from '../../hooks/useCountdown.ts';
import useTimerWarning from '../../sound/useTimerWarning.ts';
import type { GuessPublic, GuessState } from '../../../shared/guessing/types.ts';
import type { Seat } from '../../../shared/types.ts';

// The game's own words for each phase
export type GuessTexts = {
  choose: string;
  choosing(name: string): string;
  busy(word: string): string;
  busyOther(name: string): string;
  was(word: string): string;
};

type GameStatusProps = {
  gameState: GuessPublic<GuessState>;
  playerNumber: Seat;
  error: string | null;
  deadline: number | null; // when the phase ends, in server ms
  texts: GuessTexts;
};

function turnMessage(state: GuessPublic<GuessState>, playerNumber: Seat, texts: GuessTexts): string {
  const { drawer, playerNames, activePlayers, phase, word, isGameOver } = state;
  const name = drawer === null ? '' : playerNames[drawer];
  const mine = drawer === playerNumber;
  if (isGameOver) return 'Game over';
  if (activePlayers.length < 2) return 'Waiting for at least one more player';
  if (phase === 'choosing') return mine ? texts.choose : texts.choosing(name);
  if (phase === 'drawing') return mine ? texts.busy(word ?? '') : texts.busyOther(name);
  return texts.was(word ?? '');
}

export default function GameStatus({ gameState, playerNumber, error, deadline, texts }: GameStatusProps) {
  const { gameStatus, drawer, phase, guessed, isGameOver } = gameState;
  const timeLeft = useCountdown(deadline, gameState.serverTime);
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
      <div className="turn-message">{turnMessage(gameState, playerNumber, texts)}</div>
      {timeLeft !== null && (
        <div className="turn-timer" role="timer" aria-label="Time left">{formatClock(timeLeft)}</div>
      )}
    </>
  );
}
