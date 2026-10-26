import { useState } from 'react';
import gameService from '../services/gameService';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

type SpectatorViewProps = {
  client: ClientGame;
  gameState: BasePublicState;
  spectatorId: string;
  error: string | null;
};

// The table, plus the hand of the picked seat once its player allowed it
export default function SpectatorView({ client, gameState, spectatorId, error }: SpectatorViewProps) {
  const [picked, setPicked] = useState<Seat | null>(null);
  const { HistoryBoard } = client;
  const { seatViews, playerNames, activePlayers, handRequests, started, isGameOver } = gameState;
  // A seat that left the game is no longer picked
  const seat = picked !== null && activePlayers.includes(picked) ? picked : null;
  const seatView = seat !== null ? seatViews?.[seat] : undefined;
  const board = seatView ? { ...gameState, ...(seatView as object) } : gameState;
  const asked = (handRequests ?? []).some(request => request.spectator === spectatorId && request.seat === seat);
  // The server refuses a request before the game starts and after it ends
  const canAsk = started && !isGameOver;

  return (
    <div className="spectator-view">
      <div className="spectator-status">{error || gameState.gameStatus}</div>
      <HistoryBoard gameState={board} viewer={seatView ? seat : null} />
      {/* Only a game with private hands sends seatViews */}
      {seatViews && (
        <div className="spectator-seats">
          {activePlayers.map(player => (
            <button key={player} type="button" className="themed-chip" aria-pressed={seat === player} onClick={() => setPicked(player)}>
              {playerNames[player]}
            </button>
          ))}
        </div>
      )}
      {seat !== null && !seatView && canAsk && (asked ? (
        <div className="spectator-asking">{`Waiting for ${playerNames[seat]}`}</div>
      ) : (
        <button type="button" className="spectator-ask themed-chip" onClick={() => gameService.requestHand(seat)}>
          {`Ask to see ${playerNames[seat]}'s hand`}
        </button>
      ))}
      {!started && <button type="button" className="spectator-play themed-chip" onClick={() => gameService.switchToPlayer()}>Play instead</button>}
    </div>
  );
}
