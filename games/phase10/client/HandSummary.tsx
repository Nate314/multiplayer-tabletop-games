import type { HandSummary as Summary, PublicGameState, Seat } from '../types.ts';

type HandSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  seats: Seat[]; // in the order the players are shown
  onContinue: () => void;
  onClose: () => void;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export default function HandSummary({ summary, gameState, playerNumber, seats, onContinue, onClose }: HandSummaryProps) {
  const { playerNames, isGameOver, winners, gameStatus, tiebreak } = gameState;
  const tied = tiebreak.map(seat => playerNames[seat]).join(' and ');
  const result = isGameOver
    ? gameStatus
    : `${playerNames[summary.wentOut]} went out${tiebreak.length > 0 ? `. Tiebreaker next: ${tied} attempt phase 10 again` : ''}`;
  const acknowledged = summary.acknowledged.includes(playerNumber);
  const waitingFor = gameState.activePlayers
    .filter(seat => !summary.acknowledged.includes(seat) && !gameState.disconnected.includes(seat))
    .map(seat => playerNames[seat]);

  return (
    <div className="overlay summary-overlay">
      <div className="modal hand-summary" role="dialog" aria-label="Hand scoring">
        <h2>{isGameOver ? 'Final scoring' : `Hand ${summary.handNumber} scoring`}</h2>
        <div className="summary-result">{result}</div>
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
