import YouTag from '../../../src/components/YouTag.tsx';
import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { houseRule } from '../../../shared/houseRules.ts';
import { plural } from '../../../shared/text.ts';
import { TARGET_RULE } from '../options.ts';
import type { PublicGameState, RoundSummary as Summary, Seat } from '../types.ts';

// The scoring after a round: what each player gained, what they were left holding, and the totals
export function RoundRows({ summary, gameState, viewer }: { summary: Summary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, scores, activePlayers } = gameState;
  const seats = activePlayers.filter(seat => summary.sumsLeft[seat] !== undefined);
  return (
    <>
      <ul className="summary-seats">
        {seats.map(seat => (
          <li key={seat} className={seat === summary.winner ? 'summary-seat summary-winner' : 'summary-seat'}>
            <span className="summary-name">
              {playerNames[seat]}
              <YouTag when={seat === viewer} />
            </span>
            <span className="summary-points">{scores[seat]} pts</span>
            <span className="summary-reason">
              {summary.points[seat] > 0 ? `+${summary.points[seat]}: ` : ''}left holding {plural(summary.sumsLeft[seat], 'point')}
            </span>
          </li>
        ))}
      </ul>
      <div className="summary-target">First to {houseRule(gameState, TARGET_RULE)} points wins</div>
    </>
  );
}

type RoundSummaryProps = { summary: Summary; gameState: PublicGameState; playerNumber: Seat; onContinue: () => void };

// Between rounds; the last round's rows are on the game-over screen
export default function RoundSummary({ summary, gameState, playerNumber, onContinue }: RoundSummaryProps) {
  const { winner } = summary;
  let result = 'The round is blocked and tied: nobody scores';
  if (winner !== null) {
    const name = gameState.playerNames[winner];
    result = summary.blocked
      ? `${name} has the lowest total in a blocked round and scores ${summary.points[winner]} points`
      : `${name} went out and scores ${summary.points[winner]} points`;
  }
  return (
    <RoundSummaryDialog
      label="Round scoring"
      title={`Round ${summary.roundNumber} scoring`}
      gameState={gameState}
      result={result}
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
