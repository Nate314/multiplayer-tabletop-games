import { useState } from 'react';
import gameService from '../services/gameService';
import type { BasePublicState, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

type SpectatorViewProps = {
  client: ClientGame;
  gameState: BasePublicState;
  spectatorId: string;
};

// The table, plus the hand of the picked seat once its player allowed it
export default function SpectatorView({ client, gameState, spectatorId }: SpectatorViewProps) {
  const [picked, setPicked] = useState<Seat | null>(null);
  const { HistoryBoard } = client;
  const { seatViews, playerNames, activePlayers, handRequests, started } = gameState;
  const seatView = picked !== null ? seatViews?.[picked] : undefined;
  const board = seatView ? { ...gameState, ...(seatView as object) } : gameState;
  const asked = picked !== null && (handRequests ?? []).some(({ spectator, seat }) => spectator === spectatorId && seat === picked);

  return (
    <div className="spectator-view">
      <div className="spectator-status">{gameState.gameStatus}</div>
      <HistoryBoard gameState={board} viewer={seatView ? picked : null} />
      {/* Only a game with private hands sends seatViews */}
      {seatViews && (
        <div className="spectator-seats">
          {activePlayers.map(seat => (
            <button key={seat} type="button" aria-pressed={picked === seat} onClick={() => setPicked(seat)}>
              {playerNames[seat]}
            </button>
          ))}
        </div>
      )}
      {picked !== null && !seatView && (asked ? (
        <div className="spectator-asking">{`Waiting for ${playerNames[picked]}`}</div>
      ) : (
        <button type="button" className="spectator-ask" onClick={() => gameService.requestHand(picked)}>
          {`Ask to see ${playerNames[picked]}'s hand`}
        </button>
      ))}
      {!started && <button type="button" className="spectator-play" onClick={() => gameService.switchToPlayer()}>Play instead</button>}
    </div>
  );
}
