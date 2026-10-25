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

// The scoring after a round: who won, what everyone was left holding and the totals.
// Until the game is over, everyone connected clicks Continue to deal the next round.
export default function RoundSummary({ summary, gameState, playerNumber, onContinue, onClose }: RoundSummaryProps) {
  const { playerNames, isGameOver, gameStatus, scores, activePlayers } = gameState;
  const seats = activePlayers.filter(seat => summary.pipsLeft[seat] !== undefined);
  const { winner } = summary;

  let result = 'The round is blocked and tied: nobody scores';
  if (winner !== null) {
    result = summary.blocked
      ? `${playerNames[winner]} has the lowest total in a blocked round and scores ${summary.points} points`
      : `${playerNames[winner]} went out and scores ${summary.points} points`;
  }

  return (
    <RoundSummaryDialog
      label="Round scoring"
      title={isGameOver ? 'Final scoring' : `Round ${summary.roundNumber} scoring`}
      gameState={gameState}
      result={isGameOver ? gameStatus : result}
      acknowledged={summary.acknowledged}
      playerNumber={playerNumber}
      onContinue={onContinue}
      onClose={onClose}
    >
      <ul className="summary-seats">
        {seats.map(seat => (
          <li key={seat} className={seat === winner ? 'summary-seat summary-winner' : 'summary-seat'}>
            <span className="summary-name">
              {playerNames[seat]}
              {seat === playerNumber && ' (you)'}
            </span>
            <span className="summary-points">{scores[seat]} pts</span>
            <span className="summary-reason">
              {seat === winner ? `+${summary.points}: ` : ''}{plural(summary.tilesLeft[seat], 'tile')} left, {plural(summary.pipsLeft[seat], 'pip')}
            </span>
          </li>
        ))}
      </ul>
      {!summary.blocked && <div className="summary-target">The boneyard held {plural(summary.boneyardPips, 'pip')}, scored by the winner</div>}
      <div className="summary-target">First to {targetScore(gameState).toLocaleString('en-US')} points wins</div>
    </RoundSummaryDialog>
  );
}
