import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { plural } from '../../../shared/text.ts';
import { targetScore } from '../rules.ts';
import type { PublicGameState, RoundSummary as Summary, Seat } from '../types.ts';

type RoundSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
};

// The scoring after a round: who went out, what everyone was left holding and the totals.
export function RoundRows({ summary, gameState, viewer }: { summary: Summary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, scores, activePlayers } = gameState;
  const seats = activePlayers.filter(seat => summary.cardsLeft[seat] !== undefined);
  return (
    <>
      <ul className="summary-seats">
        {seats.map(seat => (
          <li key={seat} className={seat === summary.wentOut ? 'summary-seat summary-winner' : 'summary-seat'}>
            <span className="summary-name">
              {playerNames[seat]}
              {seat === viewer && ' (you)'}
            </span>
            <span className="summary-points">{scores[seat]} pts</span>
            <span className="summary-reason">
              {seat === summary.wentOut ? `Went out: +${summary.points}` : `${plural(summary.cardsLeft[seat], 'card')} left`}
            </span>
          </li>
        ))}
      </ul>
      <div className="summary-target">First to {targetScore(gameState).toLocaleString('en-US')} points wins</div>
    </>
  );
}

// Between rounds; the last round's rows are on the game-over screen
export default function RoundSummary({ summary, gameState, playerNumber, onContinue }: RoundSummaryProps) {
  const { playerNames } = gameState;

  return (
    <RoundSummaryDialog
      label="Round scoring"
      title={`Round ${summary.roundNumber} scoring`}
      gameState={gameState}
      result={`${playerNames[summary.wentOut]} went out and scores ${summary.points} points`}
      acknowledged={summary.acknowledged}
      playerNumber={playerNumber}
      onContinue={onContinue}
    >
      <RoundRows summary={summary} gameState={gameState} viewer={playerNumber} />
    </RoundSummaryDialog>
  );
}

export function FinalRound({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { roundSummary } = gameState;
  return roundSummary ? (
    <section className="game-over-round">
      <h3>Round {roundSummary.roundNumber} scoring</h3>
      <RoundRows summary={roundSummary} gameState={gameState} viewer={viewer} />
    </section>
  ) : null;
}
