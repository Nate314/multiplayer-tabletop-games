import YouTag from '../../../src/components/YouTag.tsx';
import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { BAG_LIMIT, LOSING_SCORE, targetScore, teamNames, teamOf } from '../rules.ts';
import type { HandSummary, PublicGameState, Seat, Team, TeamResult } from '../types.ts';

type RoundSummaryProps = {
  summary: HandSummary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
};

const signed = (value: number) => (value >= 0 ? `+${value}` : String(value));

// How a team's score moved, e.g. 'bid 5, took 7, made: 50 + 2 bags; Alice's nil made: +100'
function reasons(result: TeamResult, playerNames: Record<Seat, string>): string {
  const parts: string[] = [];
  if (result.contract > 0) {
    parts.push(result.made
      ? `bid ${result.contract}, took ${result.tricks}, made: ${10 * result.contract} + ${result.overtricks} ${result.overtricks === 1 ? 'bag' : 'bags'}`
      : `bid ${result.contract}, took ${result.tricks}, set: -${10 * result.contract}`);
  }
  for (const nil of result.nils) parts.push(`${playerNames[nil.seat]}'s nil ${nil.made ? 'made: +100' : 'broken: -100'}`);
  if (result.bagPenalty) parts.push(`${BAG_LIMIT} bags: -100`);
  return parts.join('; ');
}

// The scoring after a hand: each team's contract, nils and bags, and the totals.
export function RoundRows({ summary, gameState, viewer }: { summary: HandSummary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, scores, bags } = gameState;
  return (
    <>
      <ul className="summary-teams">
        {([0, 1] as Team[]).map(team => (
          <li key={team} className="summary-team">
            <span className="summary-name">
              {teamNames(team, playerNames)}
              <YouTag when={viewer !== null && teamOf(viewer) === team} />
            </span>
            <span className="summary-change">{signed(summary.teams[team].change)}</span>
            <span className="summary-points">{scores[team]} pts, {bags[team]} {bags[team] === 1 ? 'bag' : 'bags'}</span>
            <span className="summary-reason">{reasons(summary.teams[team], playerNames)}</span>
          </li>
        ))}
      </ul>
      <div className="summary-target">First to {targetScore(gameState).toLocaleString('en-US')} points wins; a team at {LOSING_SCORE} loses</div>
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
