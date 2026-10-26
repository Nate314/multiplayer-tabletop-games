import YouTag from '../../../src/components/YouTag.tsx';
import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import Tile from './Tile';
import { targetScore } from '../rules.ts';
import type { PublicGameState, RoundSummary as Summary } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

type RoundSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
};

// The scoring after a round: every finished rack, what each player scored and the totals.
export function RoundRows({ summary, gameState, viewer }: { summary: Summary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, scores, activePlayers } = gameState;
  const seats = activePlayers.filter(seat => summary.racks[seat] !== undefined);
  return (
    <>
      <ul className="summary-seats">
        {seats.map(seat => (
          <li key={seat} className={seat === summary.caller ? 'summary-seat summary-winner' : 'summary-seat'}>
            <span className="summary-name">
              {playerNames[seat]}
              <YouTag when={seat === viewer} />
            </span>
            <span className="summary-points">{scores[seat]} pts</span>
            <span className="summary-reason">{seat === summary.caller ? 'Rack-O' : 'In order from slot 1'}: +{summary.points[seat]}</span>
            <span className="summary-rack">
              {summary.racks[seat].map((card, slot) => <Tile key={slot} card={card} small />)}
            </span>
          </li>
        ))}
      </ul>
      <div className="summary-target">First to {targetScore(gameState).toLocaleString('en-US')} points wins</div>
    </>
  );
}

// Between rounds; the last round's rows are on the game-over screen
export default function RoundSummary({ summary, gameState, playerNumber, onContinue }: RoundSummaryProps) {
  const { playerNames } = gameState;

  return (
    <RoundSummaryDialog
      label="Round scoring"
      title={`Round ${summary.round} scoring`}
      gameState={gameState}
      result={`${playerNames[summary.caller]} called Rack-O and scores ${summary.points[summary.caller]} points`}
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
      <h3>Round {roundSummary.round} scoring</h3>
      <RoundRows summary={roundSummary} gameState={gameState} viewer={viewer} />
    </section>
  ) : null;
}
