import { useRef } from 'react';
import JoinQr from './JoinQr';
import useFitScale from './useFitScale.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

type TableScreenViewProps = {
  game: GameInfo;
  client: ClientGame;
  gameState: BasePublicState;
};

// The board grows up to 4 times to fill the screen
function TableBoard({ client, gameState }: Omit<TableScreenViewProps, 'game'>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { HistoryBoard } = client;
  useFitScale(boxRef, boardRef, 4);
  return (
    <div className="table-screen-board" ref={boxRef}>
      <div className="table-screen-board-content" ref={boardRef}>
        <HistoryBoard gameState={gameState} viewer={null} />
      </div>
    </div>
  );
}

// A shared screen: the join code in the lobby, then the board alone. It never shows a hand.
export default function TableScreenView({ game, client, gameState }: TableScreenViewProps) {
  const { started, gameId, activePlayers, playerNames, gameStatus } = gameState;

  if (!started) {
    return (
      <div className="table-screen">
        <JoinQr game={game} gameId={gameId} />
        <ul className="table-screen-players">
          {activePlayers.map(seat => <li key={seat}>{playerNames[seat]}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="table-screen">
      <div className="table-screen-status">{gameStatus}</div>
      <TableBoard client={client} gameState={gameState} />
    </div>
  );
}
