import YouTag from '../../../src/components/YouTag.tsx';
import RoundSummaryDialog from '../../../src/components/RoundSummaryDialog';
import { houseRule } from '../../../shared/houseRules.ts';
import { MUGGINS_RULE } from '../options.ts';
import { sideName, sideOf, targetScore } from '../rules.ts';
import { describeItems } from '../scoring.ts';
import type { CountSummary, PublicGameState, RoundSummary as Summary, Seat, Side } from '../types.ts';

type RoundSummaryProps = {
  summary: Summary;
  gameState: PublicGameState;
  playerNumber: Seat;
  onContinue: () => void;
};

// Under Muggins the owner scored their claim, so the true total and who took the rest are shown beside it
function CountRow({ count, gameState }: { count: CountSummary; gameState: PublicGameState }) {
  const { playerNames } = gameState;
  const owner = playerNames[count.owner];
  const presses = count.muggins.map(({ by, points }) =>
    points < 0 ? `${playerNames[by]} called Muggins on nothing missed: -${-points}` : `${playerNames[by]} took ${points} by Muggins`);
  return (
    <li className="summary-count">
      <span className="summary-name">{owner}'s {count.crib ? 'crib' : 'hand'}</span>
      <span className="summary-reason">{describeItems(count.items)}</span>
      {houseRule(gameState, MUGGINS_RULE) && count.claimed !== null && (
        <span className="summary-reason">
          Claimed {count.claimed} of {count.total}{presses.length ? `. ${presses.join('. ')}` : ''}
        </span>
      )}
    </li>
  );
}

// The scoring after a hand: each count's breakdown, then what each side scored and the totals
export function RoundRows({ counts, change, gameState, viewer }: { counts: CountSummary[]; change?: Record<Side, number>; gameState: PublicGameState; viewer: Seat | null }) {
  const { scores } = gameState;
  const mine = viewer !== null && gameState.playerNames[viewer] !== undefined ? sideOf(gameState, viewer) : null;
  return (
    <>
      <ul className="summary-counts">
        {counts.map((count, i) => <CountRow key={i} count={count} gameState={gameState} />)}
      </ul>
      <ul className="summary-sides">
        {Object.keys(scores).map(Number).map(side => (
          <li key={side} className="summary-side">
            <span className="summary-name">{sideName(gameState, side)}<YouTag when={side === mine} /></span>
            {change && <span className="summary-reason">+{change[side] ?? 0}</span>}
            <span className="summary-points">{scores[side]} pts</span>
          </li>
        ))}
      </ul>
      <div className="summary-target">First to {targetScore(gameState)} points wins</div>
    </>
  );
}

// Between hands; the last hand's counts are on the game-over screen
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
      <RoundRows counts={summary.counts} change={summary.change} gameState={gameState} viewer={playerNumber} />
    </RoundSummaryDialog>
  );
}

// The game ends the moment a side reaches the target, usually mid-hand, so this lists the counts made so far
export function FinalRound({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const counts = gameState.shows.flatMap(({ owner, crib, items, total, claimed, muggins }) =>
    items && total !== undefined ? [{ owner, crib, items, total, claimed, muggins }] : []);
  return (
    <section className="game-over-round">
      <h3>Hand {gameState.handNumber} scoring</h3>
      <RoundRows counts={counts} gameState={gameState} viewer={viewer} />
    </section>
  );
}
