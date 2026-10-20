import { BAG_LIMIT, LOSING_SCORE, TARGET_SCORE, teamNames, teamOf } from '../rules.ts';
import type { HandSummary, PublicGameState, Seat, Team, TeamResult } from '../types.ts';

type RoundSummaryProps = {
  summary: HandSummary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
  onClose: () => void;
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
// Until the game is over, everyone connected clicks Continue to deal the next hand.
export default function RoundSummary({ summary, gameState, playerNumber, onContinue, onClose }: RoundSummaryProps) {
  const { playerNames, isGameOver, gameStatus, scores, bags, activePlayers, disconnected } = gameState;
  const acknowledged = summary.acknowledged.includes(playerNumber);
  const waitingFor = activePlayers
    .filter(seat => !summary.acknowledged.includes(seat) && !disconnected.includes(seat))
    .map(seat => playerNames[seat]);

  return (
    <div className="overlay summary-overlay">
      <div className="modal round-summary" role="dialog" aria-label="Hand scoring">
        <h2>{isGameOver ? 'Final scoring' : `Hand ${summary.handNumber} scoring`}</h2>
        <div className="summary-result">{gameStatus}</div>
        <ul className="summary-teams">
          {([0, 1] as Team[]).map(team => (
            <li key={team} className="summary-team">
              <span className="summary-name">
                {teamNames(team, playerNames)}
                {teamOf(playerNumber) === team && ' (you)'}
              </span>
              <span className="summary-change">{signed(summary.teams[team].change)}</span>
              <span className="summary-points">{scores[team]} pts, {bags[team]} {bags[team] === 1 ? 'bag' : 'bags'}</span>
              <span className="summary-reason">{reasons(summary.teams[team], playerNames)}</span>
            </li>
          ))}
        </ul>
        <div className="summary-target">First to {TARGET_SCORE} points wins; a team at {LOSING_SCORE} loses</div>
        {isGameOver ? (
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        ) : acknowledged ? (
          <div className="summary-waiting">Waiting for {waitingFor.join(', ')}</div>
        ) : (
          <button type="button" className="primary-button" onClick={onContinue}>Continue</button>
        )}
      </div>
    </div>
  );
}
