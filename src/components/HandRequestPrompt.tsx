import type { BasePublicState } from '../../shared/types.ts';

type HandRequestPromptProps = {
  gameState: BasePublicState;
  onAnswer: (spectator: string, allow: boolean) => void;
};

// Asks a player about the first spectator waiting to see their hand; the server sends a player only their own seat's requests
export default function HandRequestPrompt({ gameState, onAnswer }: HandRequestPromptProps) {
  const request = gameState.handRequests?.[0];
  const spectator = gameState.spectators?.find(({ id }) => id === request?.spectator);
  if (!request || !spectator) return null;

  return (
    <div className="hand-request" role="group" aria-label="Hand request">
      <span>{`${spectator.name} (watching) wants to see your hand`}</span>
      <div className="hand-request-actions">
        <button type="button" className="themed-chip" onClick={() => onAnswer(spectator.id, true)}>Allow</button>
        <button type="button" className="themed-chip" onClick={() => onAnswer(spectator.id, false)}>Don't allow</button>
      </div>
    </div>
  );
}
