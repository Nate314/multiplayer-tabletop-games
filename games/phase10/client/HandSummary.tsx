import YouTag from '../../../src/components/YouTag.tsx';
import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { plural } from '../../../shared/text.ts';
import { seatOrder } from './seatOrder.ts';
import type { HandSummary as Summary, PublicGameState, Seat } from '../types.ts';

type HandSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
};

export function RoundRows({ summary, gameState, viewer }: { summary: Summary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, winners } = gameState;
  const seats = seatOrder(Object.keys(summary.seats).map(Number), viewer ?? 0);

  return (
    <ul className="summary-seats">
      {seats.map(seat => {
        const { phase, completed, cardsLeft, points, scoreAfter } = summary.seats[seat];
        return (
          <li key={seat} className={winners.includes(seat) ? 'summary-seat summary-winner' : 'summary-seat'}>
            <span className="summary-name">
              {playerNames[seat]}
              <YouTag when={seat === viewer} />
            </span>
            <span className="summary-phase">
              {phase === 0 ? 'No phase laid down' : completed ? `Phase ${phase} done` : `Phase ${phase} not done`}
            </span>
            <span className="summary-reason">{plural(cardsLeft, 'card')} left: +{points}</span>
            <span className="summary-points">{scoreAfter} pts</span>
          </li>
        );
      })}
    </ul>
  );
}

// Between hands; the last hand's rows are on the game-over screen
export default function HandSummary({ summary, gameState, playerNumber, onContinue }: HandSummaryProps) {
  const { playerNames, tiebreak } = gameState;
  const tied = tiebreak.map(seat => playerNames[seat]).join(' and ');
  const result = `${playerNames[summary.wentOut]} went out${tiebreak.length > 0 ? `. Tiebreaker next: ${tied} attempt phase 10 again` : ''}`;

  return (
    <RoundSummaryDialog
      label="Hand scoring"
      title={`Hand ${summary.handNumber} scoring`}
      gameState={gameState}
      result={result}
      acknowledged={summary.acknowledged}
      playerNumber={playerNumber}
      onContinue={onContinue}
    >
      <RoundRows summary={summary} gameState={gameState} viewer={playerNumber} />
    </RoundSummaryDialog>
  );
}

export function FinalRound({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { handSummary } = gameState;
  return handSummary ? (
    <section className="game-over-round">
      <h3>Hand {handSummary.handNumber} scoring</h3>
      <RoundRows summary={handSummary} gameState={gameState} viewer={viewer} />
    </section>
  ) : null;
}
