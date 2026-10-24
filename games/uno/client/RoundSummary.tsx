import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { plural } from '../../../shared/text.ts';
import { targetScore } from '../rules.ts';
import type { PublicGameState, RoundSummary as Summary, Seat } from '../types.ts';

type RoundSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
  onClose: () => void;
};

// The scoring after a round: who went out, what everyone was left holding and the totals.
// Until the game is over, everyone connected clicks Continue to deal the next round.
export default function RoundSummary({ summary, gameState, playerNumber, onContinue, onClose }: RoundSummaryProps) {
  const { playerNames, isGameOver, gameStatus, scores, activePlayers } = gameState;
  const seats = activePlayers.filter(seat => summary.cardsLeft[seat] !== undefined);

  return (
    <RoundSummaryDialog
      label="Round scoring"
      title={isGameOver ? 'Final scoring' : `Round ${summary.roundNumber} scoring`}
      gameState={gameState}
      result={isGameOver ? gameStatus : `${playerNames[summary.wentOut]} went out and scores ${summary.points} points`}
      acknowledged={summary.acknowledged}
      playerNumber={playerNumber}
      onContinue={onContinue}
      onClose={onClose}
    >
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
      <div className="summary-target">First to {targetScore(gameState).toLocaleString('en-US')} points wins</div>
    </RoundSummaryDialog>
  );
}
