import Grid from './Grid';
import RaceProgress from './RaceProgress';
import { modeOfState, shownBoard } from './shown.ts';
import type { PublicGameState, Seat } from '../types.ts';

// The grid right after one move, from the step's view, with that move's cell highlighted. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { givens, wrong, myNotes, lastMove, progress, playerNames } = gameState;
  return (
    <div className="sudoku-history">
      <Grid givens={givens} entries={shownBoard(gameState, viewer).entries} notes={myNotes ?? []} wrong={wrong ?? []}
        selected={null} lastCell={lastMove?.cell ?? null} />
      {modeOfState(gameState) === 'race' && <RaceProgress progress={progress} playerNames={playerNames} viewer={viewer} />}
    </div>
  );
}
