import { TARGET_SCORE } from '../rules.ts';
import type { PublicGameState, RoundSummary as Summary, Seat } from '../types.ts';

type RoundSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
  onClose: () => void;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

// The scoring after a round: who went out, what everyone was left holding and the totals.
// Until the game is over, everyone connected clicks Continue to deal the next round.
export default function RoundSummary({ summary, gameState, playerNumber, onContinue, onClose }: RoundSummaryProps) {
  const { playerNames, isGameOver, gameStatus, scores, activePlayers, disconnected } = gameState;
  const acknowledged = summary.acknowledged.includes(playerNumber);
  const waitingFor = activePlayers
    .filter(seat => !summary.acknowledged.includes(seat) && !disconnected.includes(seat))
    .map(seat => playerNames[seat]);
  const seats = activePlayers.filter(seat => summary.cardsLeft[seat] !== undefined);

  return (
    <div className="overlay summary-overlay">
      <div className="modal round-summary" role="dialog" aria-label="Round scoring">
        <h2>{isGameOver ? 'Final scoring' : `Round ${summary.roundNumber} scoring`}</h2>
        <div className="summary-result">
          {isGameOver ? gameStatus : `${playerNames[summary.wentOut]} went out and scores ${summary.points} points`}
        </div>
        <ul className="summary-seats">
          {seats.map(seat => (
            <li key={seat} className={seat === summary.wentOut ? 'summary-seat summary-winner' : 'summary-seat'}>
              <span className="summary-name">
                {playerNames[seat]}
                {seat === playerNumber && ' (you)'}
              </span>
              <span className="summary-points">{scores[seat]} pts</span>
              <span className="summary-reason">
                {seat === summary.wentOut ? `Went out: +${summary.points}` : `${plural(summary.cardsLeft[seat], 'card')} left`}
              </span>
            </li>
          ))}
        </ul>
        <div className="summary-target">First to {TARGET_SCORE} points wins</div>
        {isGameOver ? (
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        ) : acknowledged ? (
          <div className="summary-waiting">Waiting for {waitingFor.join(', ')}</div>
        ) : (
          <button type="button" className="primary-button" onClick={onContinue}>Continue</button>
        )}
      </div>
    </div>
  );
}
