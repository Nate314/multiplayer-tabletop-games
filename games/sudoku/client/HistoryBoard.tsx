import Grid from './Grid';
import BoardPicker from './BoardPicker';
import RaceProgress from './RaceProgress';
import useBoardOwner from './useBoardOwner.ts';
import { lastCellOn, modeOfState, shownBoard } from './shown.ts';
import type { PublicGameState, Seat } from '../types.ts';

// The grid right after one move, from the step's view, with that move's cell highlighted. Nothing is clickable.
// Spectators and the table screen see the game through this too.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { givens, wrong, myNotes, progress, playerNames } = gameState;
  const [owner, pick] = useBoardOwner(gameState, viewer);
  return (
    <div className="sudoku-history">
      <BoardPicker gameState={gameState} owner={owner} onPick={pick} />
      <Grid givens={givens} entries={shownBoard(gameState, owner).entries} notes={myNotes ?? []} wrong={wrong ?? []}
        selected={null} lastCell={lastCellOn(gameState, owner)} />
      {modeOfState(gameState) === 'race' && <RaceProgress progress={progress} playerNames={playerNames} viewer={viewer} />}
    </div>
  );
}
