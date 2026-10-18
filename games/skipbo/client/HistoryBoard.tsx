import Board from './Board';
import Hand from './Hand';
import PlayerArea from './PlayerArea';
import { seatOrder } from './seatOrder.ts';
import type { PublicGameState } from '../types.ts';
import type { Seat } from '../../../shared/types.ts';

// The table right after one move, with the building pile and the player's pile it used highlighted.
// Viewed as a player, their hand is shown too, read only. Nothing is clickable.
export default function HistoryBoard({ gameState, viewer }: { gameState: PublicGameState; viewer: Seat | null }) {
  const { lastMove, myHand, playerNames, activePlayers } = gameState;
  const lastPile = lastMove?.type === 'play' ? lastMove.to : null;
  return (
    <div className="skipbo-history">
      <Board gameState={gameState} picked={null} onPlay={() => {}} lastPile={lastPile} />
      {viewer !== null && <Hand cards={myHand} label={`${playerNames[viewer]}'s hand (${myHand.length})`} />}
      <div className="other-seats">
        {seatOrder(activePlayers, viewer).map(seat => (
          <PlayerArea key={seat} gameState={gameState} seat={seat} lastMove={lastMove} />
        ))}
      </div>
    </div>
  );
}
