import Factories from './Factories';
import PlayerBoard from './PlayerBoard';
import type { PublicGameState } from '../types.ts';

// The table and every board right after one move, with where the tiles came from and went highlighted.
// Nothing is clickable and the round summary stays hidden; a round-ending move shows the scored walls.
export default function HistoryBoard({ gameState }: { gameState: PublicGameState }) {
  const { boards, playerNames, currentPlayer, activePlayers, winners, lastMove } = gameState;

  return (
    <>
      <Factories gameState={gameState} isMyTurn={false} selection={null} onSelect={() => {}} />
      <div className="boards">
        {Object.keys(boards).map(Number).map(seat => (
          <PlayerBoard
            key={seat}
            board={boards[seat]}
            seat={seat}
            name={playerNames[seat]}
            isMe={false}
            isCurrent={currentPlayer === seat}
            hasLeft={!activePlayers.includes(seat)}
            isWinner={winners.includes(seat)}
            selectedColor={null}
            lastLine={lastMove?.playerNumber === seat ? lastMove.line : null}
            onPlace={() => {}}
          />
        ))}
      </div>
    </>
  );
}
