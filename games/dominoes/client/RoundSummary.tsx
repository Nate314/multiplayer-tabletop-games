import YouTag from '../../../src/components/YouTag.tsx';
import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { plural } from '../../../shared/text.ts';
import { targetScore } from '../rules.ts';
import type { PublicGameState, RoundSummary as Summary, Seat } from '../types.ts';

type RoundSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
};

// The scoring after a round: who won, what everyone was left holding and the totals.
export function RoundRows({ summary, gameState, viewer }: { summary: Summary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, scores, activePlayers } = gameState;
  const seats = activePlayers.filter(seat => summary.pipsLeft[seat] !== undefined);
  const { winner } = summary;

  return (
    <>
      <ul className="summary-seats">
        {seats.map(seat => (
          <li key={seat} className={seat === winner ? 'summary-seat summary-winner' : 'summary-seat'}>
            <span className="summary-name">
              {playerNames[seat]}
              <YouTag when={seat === viewer} />
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
    </>
  );
}

// Between rounds; the last round's rows are on the game-over screen
export default function RoundSummary({ summary, gameState, playerNumber, onContinue }: RoundSummaryProps) {
  const { playerNames } = gameState;
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
