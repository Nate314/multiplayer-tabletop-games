import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { SEATS, targetScore } from '../rules.ts';
import type { HandSummary, PublicGameState, Seat } from '../types.ts';

type RoundSummaryProps = {
  summary: HandSummary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
  onClose: () => void;
};

// The scoring after a hand: what each player took, what they score and the totals.
// Until the game is over, everyone connected clicks Continue to deal the next hand.
export default function RoundSummary({ summary, gameState, playerNumber, onContinue, onClose }: RoundSummaryProps) {
  const { playerNames, isGameOver, scores } = gameState;

  return (
    <RoundSummaryDialog
      label="Hand scoring"
      title={isGameOver ? 'Final scoring' : `Hand ${summary.handNumber} scoring`}
      gameState={gameState}
      acknowledged={summary.acknowledged}
      playerNumber={playerNumber}
      onContinue={onContinue}
      onClose={onClose}
    >
      <ul className="summary-players">
        {SEATS.filter(seat => playerNames[seat] !== undefined).map(seat => (
          <li key={seat} className={seat === summary.moon ? 'summary-player summary-moon' : 'summary-player'}>
            <span className="summary-name">{playerNames[seat]}{seat === playerNumber && ' (you)'}</span>
            <span className="summary-reason">took {summary.taken[seat]}: +{summary.change[seat]}</span>
            <span className="summary-points">{scores[seat]} pts</span>
          </li>
        ))}
      </ul>
      <div className="summary-target">The game ends when someone reaches {targetScore(gameState).toLocaleString('en-US')}; the lowest score wins</div>
    </RoundSummaryDialog>
  );
}
