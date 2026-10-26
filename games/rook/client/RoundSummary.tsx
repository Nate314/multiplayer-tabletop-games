import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { namesOf, targetScore, teamOfSeat, teamsOf } from '../rules.ts';
import type { HandSummary, PublicGameState, Seat } from '../types.ts';

type RoundSummaryProps = {
  summary: HandSummary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
};

const signed = (value: number) => (value >= 0 ? `+${value}` : String(value));

// The scoring after a hand: the bid, what each team took and the totals.
export function RoundRows({ summary, gameState, viewer }: { summary: HandSummary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, scores } = gameState;
  const { partners } = summary; // set only with called partners, at 5 and 7 players
  const bidTeams = [summary.bidder, ...(partners ?? [])].map(seat => teamOfSeat(gameState, seat));
  const bidderName = playerNames[summary.bidder];
  let side = '';
  if (partners?.length === 0) side = ` ${bidderName} played alone.`;
  else if (partners) side = ` ${namesOf(partners, playerNames)} ${partners.length === 1 ? 'was' : 'were'} ${bidderName}'s partner${partners.length === 1 ? '' : 's'}.`;

  return (
    <>
      <div className="summary-detail">
        {bidderName} bid {summary.bid} and {summary.made ? 'made it' : 'went set'}.{side}
        {' '}{playerNames[summary.lastTrick]} took the last trick and the nest ({summary.nestPoints} points).
      </div>
      <ul className="summary-teams">
        {teamsOf(gameState).map((team, index) => (
          <li key={index} className={bidTeams.includes(index) ? 'summary-team summary-bidders' : 'summary-team'}>
            <span className="summary-name">
              {namesOf(team, playerNames)}
              {viewer !== null && team.includes(viewer) && ' (you)'}
            </span>
            <span className="summary-reason">took {summary.points[index]}: {signed(summary.change[index])}</span>
            <span className="summary-points">{scores[index]} pts</span>
          </li>
        ))}
      </ul>
      <div className="summary-target">First to {targetScore(gameState).toLocaleString('en-US')} points wins</div>
    </>
  );
}

// Between rounds; the last round's rows are on the game-over screen
export default function RoundSummary({ summary, gameState, playerNumber, onContinue }: RoundSummaryProps) {
  return (
    <RoundSummaryDialog
      label="Hand scoring"
      title={`Hand ${summary.handNumber} scoring`}
      gameState={gameState}
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
      <h3>Hand {roundSummary.handNumber} scoring</h3>
      <RoundRows summary={roundSummary} gameState={gameState} viewer={viewer} />
    </section>
  ) : null;
}
