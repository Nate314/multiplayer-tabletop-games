import type { BasePublicState, Seat } from '../../shared/types.ts';
import type { ClientGame } from '../clientGames.ts';

type HandoffScreenProps = {
  client: ClientGame;
  gameState: BasePublicState;
  localSeats: { seat: Seat; name: string }[];
  onShow: (seat: Seat) => void;
};

// A shared device between turns: the public table, dimmed, under a banner naming who takes the device next
export default function HandoffScreen({ client, gameState, localSeats, onShow }: HandoffScreenProps) {
  const { HistoryBoard } = client;
  const waitingOn = gameState.waitingOn ?? [];
  const next = localSeats.find(local => waitingOn.includes(local.seat));
  const others = localSeats.filter(local => local !== next);
  const waitingNames = waitingOn.map(seat => gameState.playerNames[seat]).join(', ');

  return (
    <div className="handoff">
      <div className="handoff-table" aria-hidden="true" inert>
        <HistoryBoard gameState={gameState} viewer={null} />
      </div>
      <section className="handoff-banner" aria-label="Pass the device">
        {next ? (
          <>
            <h2>{`Pass to ${next.name}`}</h2>
            <button type="button" className="primary-button" onClick={() => onShow(next.seat)}>
              {`I'm ${next.name}, show my hand`}
            </button>
          </>
        ) : (
          <h2>{waitingNames ? `Waiting for ${waitingNames}` : gameState.gameStatus}</h2>
        )}
        {/* Any local player can take the device, so a wait the table does not report never gets stuck */}
        {others.length > 0 && (
          <div className="handoff-others">
            <span>Someone else?</span>
            {others.map(local => (
              <button key={local.seat} type="button" className="themed-chip" onClick={() => onShow(local.seat)}>{`I'm ${local.name}`}</button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
