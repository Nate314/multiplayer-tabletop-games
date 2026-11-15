import RaceBoard from './RaceBoard';
import type { Seat } from '../../../shared/types.ts';
import type { PublicGameState } from '../types.ts';

// "Ana 12/16", with a check mark once that seat filled its board
const progressText = ({ playerNames, placedCounts, finishTimes, layout }: PublicGameState, seat: Seat) =>
  `${playerNames[seat]} ${placedCounts[seat] ?? 0}/${layout?.size ?? 0}${finishTimes[seat] !== undefined ? ' ✓' : ''}`;

// One bar per seat
export function Progress({ gameState, seats }: { gameState: PublicGameState; seats: Seat[] }) {
  return (
    <ul className="sr-progress" aria-label="Progress">
      {seats.map(seat => {
        const text = progressText(gameState, seat);
        return (
          <li key={seat}>
            <span className="sr-progress-text">{text}</span>
            <progress max={gameState.layout?.size ?? 0} value={gameState.placedCounts[seat] ?? 0} aria-label={text} />
          </li>
        );
      })}
    </ul>
  );
}

// A player sees their own board; spectators see every board sent, small and side by side; the table screen during
// the race is sent none, so it sees the bars alone. The last placed hole is outlined. Nothing can be dragged
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { layout, boards, playerNames, lastMove, activePlayers, popped, isGameOver } = gameState;
  if (!layout) return <Progress gameState={gameState} seats={activePlayers} />;
  const highlight = (seat: Seat) => lastMove?.playerNumber === seat ? lastMove.hole ?? null : null;
  const own = viewer === null ? undefined : boards[viewer];
  if (own) return <div className="sr-history"><RaceBoard layout={layout} placed={own.placed} highlight={highlight(viewer!)} /></div>;
  const seats = activePlayers.filter(seat => boards[seat]);
  if (seats.length === 0) return <Progress gameState={gameState} seats={activePlayers} />;
  return (
    <ul className="sr-boards">
      {seats.map(seat => (
        <li key={seat}>
          <span className="sr-board-label">{progressText(gameState, seat)}</span>
          <RaceBoard layout={layout} placed={boards[seat]!.placed} highlight={highlight(seat)} popped={popped && isGameOver} label={`${playerNames[seat]}'s board`} />
        </li>
      ))}
    </ul>
  );
}
