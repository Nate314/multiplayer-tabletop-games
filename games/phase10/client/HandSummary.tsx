import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { plural } from '../../../shared/text.ts';
import type { HandSummary as Summary, PublicGameState, Seat } from '../types.ts';

type HandSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  seats: Seat[]; // in the order the players are shown
  onContinue: () => void;
  onClose: () => void;
};

export default function HandSummary({ summary, gameState, playerNumber, seats, onContinue, onClose }: HandSummaryProps) {
  const { playerNames, isGameOver, winners, gameStatus, tiebreak } = gameState;
  const tied = tiebreak.map(seat => playerNames[seat]).join(' and ');
  const result = isGameOver
    ? gameStatus
    : `${playerNames[summary.wentOut]} went out${tiebreak.length > 0 ? `. Tiebreaker next: ${tied} attempt phase 10 again` : ''}`;

  return (
    <RoundSummaryDialog
      label="Hand scoring"
      title={isGameOver ? 'Final scoring' : `Hand ${summary.handNumber} scoring`}
      gameState={gameState}
      result={result}
      acknowledged={summary.acknowledged}
      playerNumber={playerNumber}
      onContinue={onContinue}
      onClose={onClose}
    >
      <ul className="summary-seats">
        {seats.filter(seat => summary.seats[seat]).map(seat => {
          const { phase, completed, cardsLeft, points, scoreAfter } = summary.seats[seat];
          return (
            <li key={seat} className={winners.includes(seat) ? 'summary-seat summary-winner' : 'summary-seat'}>
              <span className="summary-name">
                {playerNames[seat]}
                {seat === playerNumber && ' (you)'}
              </span>
              <span className="summary-phase">
                {completed ? `Phase ${phase} done` : `Phase ${phase} not done`}
              </span>
              <span className="summary-reason">{plural(cardsLeft, 'card')} left: +{points}</span>
              <span className="summary-points">{scoreAfter} pts</span>
            </li>
          );
        })}
      </ul>
    </RoundSummaryDialog>
  );
}
