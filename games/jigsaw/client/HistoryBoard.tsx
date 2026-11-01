import { MODE_RULE, modeOf } from '../../../shared/puzzleModes.ts';
import Table from './Table';
import type { Seat } from '../../../shared/types.ts';
import type { PublicGameState } from '../types.ts';

// The table right after one step, with that piece outlined. Nothing can be dragged.
// In a Race the viewer sees their own board (everyone's once over); a viewer with no board sees the percentages alone.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { picture, count, seed, playerNames, lastMove, progress } = gameState;
  const race = modeOf(gameState, MODE_RULE) === 'race';
  const board = race ? (viewer === null ? undefined : gameState.boards[viewer]) : gameState.board;
  return (
    <div className="jigsaw-history">
      {board ? (
        <Table picture={picture} count={count} seed={seed} board={board} viewer={viewer} playerNames={playerNames}
          highlight={lastMove?.piece ?? null} />
      ) : (
        <ul className="jigsaw-history-progress">
          {Object.entries(progress).map(([seat, percent]) => <li key={seat}>{playerNames[Number(seat) as Seat]}: {percent}%</li>)}
        </ul>
      )}
    </div>
  );
}
