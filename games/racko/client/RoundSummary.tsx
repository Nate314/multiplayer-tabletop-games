import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import Tile from './Tile';
import { TARGET_SCORE } from '../rules.ts';
import type { PublicGameState, RoundSummary as Summary } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

type RoundSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
  onClose: () => void;
};

// The scoring after a round: every finished rack, what each player scored and the totals.
// Until the game is over, everyone connected clicks Continue to deal the next round.
export default function RoundSummary({ summary, gameState, playerNumber, onContinue, onClose }: RoundSummaryProps) {
  const { playerNames, isGameOver, gameStatus, scores, activePlayers } = gameState;
  const seats = activePlayers.filter(seat => summary.racks[seat] !== undefined);

  return (
    <RoundSummaryDialog
      label="Round scoring"
      title={isGameOver ? 'Final scoring' : `Round ${summary.round} scoring`}
      gameState={gameState}
      result={isGameOver ? gameStatus : `${playerNames[summary.caller]} called Rack-O and scores ${summary.points[summary.caller]} points`}
      acknowledged={summary.acknowledged}
      playerNumber={playerNumber}
      onContinue={onContinue}
      onClose={onClose}
    >
      <ul className="summary-seats">
        {seats.map(seat => (
          <li key={seat} className={seat === summary.caller ? 'summary-seat summary-winner' : 'summary-seat'}>
            <span className="summary-name">
              {playerNames[seat]}
              {seat === playerNumber && ' (you)'}
            </span>
            <span className="summary-points">{scores[seat]} pts</span>
            <span className="summary-reason">{seat === summary.caller ? 'Rack-O' : 'In order from slot 1'}: +{summary.points[seat]}</span>
            <span className="summary-rack">
              {summary.racks[seat].map((card, slot) => <Tile key={slot} card={card} small />)}
            </span>
          </li>
        ))}
      </ul>
      <div className="summary-target">First to {TARGET_SCORE} points wins</div>
    </RoundSummaryDialog>
  );
}
