import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { namesOf, targetScore, teamOfSeat, teamsOf } from '../rules.ts';
import type { HandSummary, PublicGameState, Seat } from '../types.ts';

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
  const { partners } = summary; // set only with called partners, at 5 and 7 players
  const bidTeams = [summary.bidder, ...(partners ?? [])].map(seat => teamOfSeat(gameState, seat));
  const bidderName = playerNames[summary.bidder];
  let side = '';
  if (partners?.length === 0) side = ` ${bidderName} played alone.`;
  else if (partners) side = ` ${namesOf(partners, playerNames)} ${partners.length === 1 ? 'was' : 'were'} ${bidderName}'s partner${partners.length === 1 ? '' : 's'}.`;

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
        {bidderName} bid {summary.bid} and {summary.made ? 'made it' : 'went set'}.{side}
        {' '}{playerNames[summary.lastTrick]} took the last trick and the nest ({summary.nestPoints} points).
      </div>
      <ul className="summary-teams">
        {teamsOf(gameState).map((team, index) => (
          <li key={index} className={bidTeams.includes(index) ? 'summary-team summary-bidders' : 'summary-team'}>
            <span className="summary-name">
              {namesOf(team, playerNames)}
              {team.includes(playerNumber) && ' (you)'}
            </span>
            <span className="summary-reason">took {summary.points[index]}: {signed(summary.change[index])}</span>
            <span className="summary-points">{scores[index]} pts</span>
          </li>
        ))}
      </ul>
      <div className="summary-target">First to {targetScore(gameState).toLocaleString('en-US')} points wins</div>
    </RoundSummaryDialog>
  );
}
