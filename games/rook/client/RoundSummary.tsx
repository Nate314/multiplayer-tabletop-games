import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { targetScore, teamNames, teamOf } from '../rules.ts';
import type { HandSummary, PublicGameState, Seat, Team } from '../types.ts';

type RoundSummaryProps = {
  summary: HandSummary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
  onClose: () => void;
};

const signed = (value: number) => (value >= 0 ? `+${value}` : String(value));

// The scoring after a hand: the bid, what each team took and the totals.
// Until the game is over, everyone connected clicks Continue to deal the next hand.
export default function RoundSummary({ summary, gameState, playerNumber, onContinue, onClose }: RoundSummaryProps) {
  const { playerNames, isGameOver, scores } = gameState;
  const bidTeam = teamOf(summary.bidder);

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
      <div className="summary-detail">
        {playerNames[summary.bidder]} bid {summary.bid} and {summary.made ? 'made it' : 'went set'}.
        {' '}{playerNames[summary.lastTrick]} took the last trick and the nest ({summary.nestPoints} points).
      </div>
      <ul className="summary-teams">
        {([0, 1] as Team[]).map(team => (
          <li key={team} className={team === bidTeam ? 'summary-team summary-bidders' : 'summary-team'}>
            <span className="summary-name">
              {teamNames(team, playerNames)}
              {teamOf(playerNumber) === team && ' (you)'}
            </span>
            <span className="summary-reason">took {summary.points[team]}: {signed(summary.change[team])}</span>
            <span className="summary-points">{scores[team]} pts</span>
          </li>
        ))}
      </ul>
      <div className="summary-target">First to {targetScore(gameState)} points wins</div>
    </RoundSummaryDialog>
  );
}
