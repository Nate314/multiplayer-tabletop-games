import { boardOf } from '../board.ts';
import Board from './Board';
import { boardAreaClass } from './layout.ts';
import Dice from './Dice';
import HandPanel from './HandPanel';
import PlayerList from './PlayerList';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The island and every player right after one move, read only. Viewed as a player, that player's own cards are shown
// (a game file's views carry them); the table view has no hand to show.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  return (
    <div className="history-layout">
      <div className={boardAreaClass(boardOf(gameState.layout))}>
        <Board gameState={gameState} />
        <Dice dice={gameState.dice} />
      </div>
      <div className="history-side">
        {viewer !== null && <HandPanel gameState={gameState} playerNumber={viewer} canPlay={false} onMove={() => {}} />}
        <PlayerList gameState={gameState} viewer={viewer} />
      </div>
    </div>
  );
}
