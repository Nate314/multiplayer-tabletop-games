import { formatClock, useCountdown } from '../../../src/hooks/useCountdown.ts';
import useTimerWarning from '../../../src/sound/useTimerWarning.ts';
import { houseRule } from '../../../shared/houseRules.ts';
import { phaseDeadline } from '../clock.ts';
import { fictionaryInfo } from '../info.ts';
import { WORD_COUNT } from '../options.ts';
import type { PublicGameState, Seat } from '../types.ts';

// Whether this seat still owes a definition or a vote in the running phase
function owesMove(gameState: PublicGameState, seat: Seat): boolean {
  const { phase, isGameOver, phaseStartedAt, activePlayers, submission, matched, myVote } = gameState;
  if (isGameOver || phaseStartedAt === null || !activePlayers.includes(seat)) return false;
  if (phase === 'writing') return submission === null;
  return phase === 'voting' && !matched.includes(seat) && myVote === null;
}

function turnMessage(gameState: PublicGameState, seat: Seat): string {
  const { isGameOver, phaseStartedAt, activePlayers, phase } = gameState;
  const { minPlayers } = fictionaryInfo;
  if (isGameOver) return 'Game over';
  if (phaseStartedAt === null) return activePlayers.length < minPlayers ? `Waiting for at least ${minPlayers} players` : 'Waiting for the house rules';
  if (phase === 'reveal') return 'Round over';
  if (owesMove(gameState, seat)) return phase === 'writing' ? 'Write a believable definition' : 'Click the definition you think is real';
  return phase === 'writing' ? 'Waiting for the others to write' : 'Waiting for the others to vote';
}

// The word in large type with the round and the clock, then the status line
export default function GameStatus({ gameState, playerNumber, error }: { gameState: PublicGameState; playerNumber: Seat; error: string | null }) {
  const { word, round, gameStatus } = gameState;
  const timeLeft = useCountdown(phaseDeadline(gameState), gameState.serverTime);
  useTimerWarning(timeLeft, owesMove(gameState, playerNumber));

  return (
    <div className="game-info">
      <div className="fictionary-word">{word}</div>
      <div className="fictionary-round">
        Round {round} of {houseRule(gameState, WORD_COUNT)}
        {timeLeft !== null && <span className="turn-timer" role="timer" aria-label="Time left">{formatClock(timeLeft)}</span>}
      </div>
      {(error || gameStatus) && (
        <div className={error ? 'game-status game-status-error' : 'game-status'}>{error || gameStatus}</div>
      )}
      <div className="turn-message">{turnMessage(gameState, playerNumber)}</div>
    </div>
  );
}
