import YouTag from '../../../src/components/YouTag.tsx';
import { pointsText } from '../../../shared/standings.ts';
import { corneredText } from './describeMove.ts';
import Hand from './Hand';
import OfferBoard from './OfferBoard';
import type { PublicGameState, RoundSummary, Seat } from '../types.ts';

// The floor right after one swap or corner, with who moved highlighted. Viewed as a player, their hand is shown read only
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { hand, playerNames } = gameState;
  return (
    <div className="tf-layout tf-history">
      <OfferBoard gameState={gameState} viewer={viewer} showLastMove />
      {viewer !== null && <Hand cards={hand} label={`${playerNames[viewer]}'s hand (${hand.length})`} />}
    </div>
  );
}

// The corner's revealed hand, then every seat's total with any Bull or Bear penalty
export function SummaryRows({ summary, gameState, viewer }: { summary: RoundSummary; gameState: PublicGameState; viewer: Seat | null }) {
  const { playerNames, activePlayers, scores } = gameState;
  return (
    <>
      <Hand cards={summary.hand} label={`${playerNames[summary.winner]}'s corner`} />
      <ul className="summary-seats">
        {activePlayers.map(seat => (
          <li key={seat} className={seat === summary.winner ? 'summary-seat summary-winner' : 'summary-seat'}>
            <span className="summary-name">{playerNames[seat]}<YouTag when={seat === viewer} /></span>
            <span className="summary-points">{pointsText(scores[seat] ?? 0)}</span>
            <span className="summary-reason">
              {seat === summary.winner && `+${summary.corner.points} for the corner`}
              {summary.penalties[seat] !== undefined && `${summary.penalties[seat]} for holding the Bull or Bear`}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function FinalRound({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { summary, playerNames } = gameState;
  return summary ? (
    <section className="game-over-round">
      <h3>Round {summary.round}: {corneredText(playerNames[summary.winner], summary.corner)}</h3>
      <SummaryRows summary={summary} gameState={gameState} viewer={viewer} />
    </section>
  ) : null;
}
