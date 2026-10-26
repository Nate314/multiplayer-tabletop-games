import YouTag from '../../../src/components/YouTag.tsx';
import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { targetScore, teamNames, teamOf } from '../rules.ts';
import type { HandSummary, PublicGameState, Seat, Team } from '../types.ts';

type RoundSummaryProps = {
  summary: HandSummary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
};

// The scoring after a hand: who made trump, the tricks each team took and the totals.
export function RoundRows({ summary, gameState, viewer }: { summary: HandSummary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, scores } = gameState;
  const makers = teamOf(summary.maker);
  return (
    <>
      <div className="summary-detail">
        {playerNames[summary.maker]} made trump{summary.alone && ' and went alone'}.
      </div>
      <ul className="summary-teams">
        {([0, 1] as Team[]).map(team => (
          <li key={team} className={team === makers ? 'summary-team summary-makers' : 'summary-team'}>
            <span className="summary-name">
              {teamNames(team, playerNames)}
              <YouTag when={viewer !== null && teamOf(viewer) === team} />
            </span>
            <span className="summary-reason">
              {summary.tricks[team]} {summary.tricks[team] === 1 ? 'trick' : 'tricks'}: +{summary.change[team]}
            </span>
            <span className="summary-points">{scores[team]} pts</span>
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
