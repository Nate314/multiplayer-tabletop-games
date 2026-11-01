import YouTag from '../../../src/components/YouTag.tsx';
import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import gameService from '../../../src/services/gameService';
import Peg from './Peg';
import { ROUNDS_EACH } from '../options.ts';
import { pointsText } from '../../../shared/standings.ts';
import { plural } from '../../../shared/text.ts';
import type { PublicGameState, RoundResult, RoundSummary, Seat } from '../types.ts';

const ROUNDS = 2 * ROUNDS_EACH;

const pegsOf = (result: RoundResult) => (
  <span className="cb-pegs cb-pegs-small">{result.code.map((color, i) => <Peg key={i} color={color} />)}</span>
);

const outcome = (result: RoundResult): string => result.broken ? plural(result.guesses, 'guess', 'guesses') : 'Not broken';

// One line per finished Classic round: who broke, the code, and the points the breaker took
export default function RoundRows({ rounds, playerNames, viewer }: { rounds: RoundResult[]; playerNames: Record<Seat, string>; viewer: Seat | null }) {
  return (
    <ul className="cb-rounds">
      {rounds.map(result => (
        <li key={result.round} className="cb-round-row">
          <span className="cb-round-name">
            Round {result.round}: {playerNames[result.breaker]}<YouTag when={result.breaker === viewer} />
          </span>
          {pegsOf(result)}
          <span className="cb-round-points">{outcome(result)}, +{pointsText(result.points)}</span>
        </li>
      ))}
    </ul>
  );
}

// Each player's points so far
export function Totals({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { activePlayers, playerNames, points } = gameState;
  return (
    <ul className="cb-scores" aria-label="Points">
      {activePlayers.map(seat => (
        <li key={seat}>
          <span>{playerNames[seat]}<YouTag when={seat === viewer} /></span>
          <span>{pointsText(points[seat] ?? 0)}</span>
        </li>
      ))}
    </ul>
  );
}

// Between Classic rounds: the revealed code and the breaker's points, then Continue
export function RoundSummaryView({ summary, gameState, playerNumber }: { summary: RoundSummary; gameState: PublicGameState; playerNumber: Seat }) {
  const { playerNames } = gameState;
  return (
    <RoundSummaryDialog
      label="Round scoring"
      title={`Round ${summary.round} of ${ROUNDS}`}
      gameState={gameState}
      acknowledged={summary.acknowledged}
      playerNumber={playerNumber}
      onContinue={() => gameService.sendAction({ type: 'continue' })}
    >
      <div className="cb-summary-code">
        <span>The code</span>
        {pegsOf(summary)}
      </div>
      <div className="cb-summary-points">{playerNames[summary.breaker]} scores {pointsText(summary.points)}</div>
      <Totals gameState={gameState} viewer={playerNumber} />
      <div className="cb-summary-note">Lowest total after {ROUNDS} rounds wins</div>
    </RoundSummaryDialog>
  );
}

// The game-over screen's scoring: every Classic round
export function FinalRound({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { rounds, playerNames } = gameState;
  return rounds.length > 0 ? (
    <section className="game-over-round">
      <h3>Rounds</h3>
      <RoundRows rounds={rounds} playerNames={playerNames} viewer={viewer} />
    </section>
  ) : null;
}
