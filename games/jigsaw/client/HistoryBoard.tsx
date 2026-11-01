import { MODE_RULE, modeOf } from '../../../shared/puzzleModes.ts';
import Table from './Table';
import type { Seat } from '../../../shared/types.ts';
import type { Board, PublicGameState } from '../types.ts';

// The table right after one step, with that piece outlined. Nothing can be dragged.
// In a Race a player sees their own board. A viewer with no seat (a spectator) sees every board it was sent,
// each small and labelled; when no boards were sent (a table screen, History during play) it sees the percentages alone.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { picture, count, seed, playerNames, lastMove, progress } = gameState;
  const race = modeOf(gameState, MODE_RULE) === 'race';
  const table = (board: Board, highlight: number | null) => (
    <Table picture={picture} count={count} seed={seed} board={board} viewer={viewer} playerNames={playerNames} highlight={highlight} />
  );
  const label = (seat: Seat) => `${playerNames[seat]}: ${progress[seat] ?? 0}%`;

  if (!race) return <div className="jigsaw-history">{table(gameState.board, lastMove?.piece ?? null)}</div>;
  const own = viewer === null ? undefined : gameState.boards[viewer];
  if (own) return <div className="jigsaw-history">{table(own, lastMove?.piece ?? null)}</div>;
  const boards = Object.entries(gameState.boards) as [string, Board][];
  return (
    <div className="jigsaw-history">
      {boards.length > 0 ? (
        <ul className="jigsaw-history-boards">
          {boards.map(([key, board]) => {
            const seat = Number(key) as Seat;
            return (
              <li key={key} aria-label={`${playerNames[seat]}'s board`}>
                <span className="jigsaw-history-label">{label(seat)}</span>
                {table(board, lastMove?.playerNumber === seat ? lastMove.piece : null)}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="jigsaw-history-progress">
          {Object.keys(progress).map(key => <li key={key}>{label(Number(key) as Seat)}</li>)}
        </ul>
      )}
    </div>
  );
}
