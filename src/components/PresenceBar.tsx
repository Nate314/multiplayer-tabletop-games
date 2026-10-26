import { useCountdown } from '../hooks/useCountdown.ts';
import ReactionPicker from './ReactionPicker';
import { keepOnScreen } from './keepOnScreen.ts';
import { reactionLabel } from './reactions.ts';
import useReactions from './useReactions.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type PresenceBarProps = {
  gameState: BasePublicState;
  playerNumber: Seat | null; // null for a spectator
  spectatorId: string | null;
  onDismiss: ((seat: Seat) => void) | null; // null for a spectator, who cannot start a vote
};

// Lists every player (tap another's name to react; held seats get a way to start a dismiss vote) and who is watching
export default function PresenceBar({ gameState, playerNumber, spectatorId, onDismiss }: PresenceBarProps) {
  const { disconnected, activePlayers, playerNames, currentPlayer, isGameOver, started, undoVote, dismissVote } = gameState;
  const watchers = gameState.spectators ?? [];
  const myName = playerNumber !== null
    ? playerNames[playerNumber]
    : watchers.find(spectator => spectator.id === spectatorId)?.name;
  const { bubbles, cooldownUntil } = useReactions(playerNumber, myName, playerNumber === null);
  // cooldownUntil is on this device's clock, so no server offset (a stale one inflated the countdown)
  const cooldownMs = useCountdown(cooldownUntil, undefined) ?? 0;
  if (activePlayers.length < 2 && disconnected.length === 0 && watchers.length === 0) return null;

  const voteOpen = undoVote !== null || dismissVote !== null;
  const waitingFor = !isGameOver && currentPlayer !== null && disconnected.includes(currentPlayer) ? currentPlayer : null;

  return (
    <div className="presence-bar">
      <ul className="presence-list">
        {activePlayers.map(seat => {
          const held = disconnected.includes(seat);
          return (
            <li key={seat} className="presence-player" data-disconnected={held ? '' : undefined}>
              {held ? <span>{`${playerNames[seat]} (disconnected)`}</span>
                : seat === playerNumber ? <span>{playerNames[seat]}</span>
                : <ReactionPicker target={seat} name={playerNames[seat]} disabled={!started || isGameOver} cooldownMs={cooldownMs} />}
              {/* After the game is over nothing waits on them, so there is nothing to dismiss */}
              {held && !isGameOver && onDismiss && (
                <button type="button" className="dismiss-button" disabled={voteOpen} onClick={() => onDismiss(seat)}>
                  Dismiss
                </button>
              )}
              {bubbles[seat] && (
                <span key={bubbles[seat].at} className="reaction-bubble" ref={keepOnScreen} role="status">{reactionLabel(bubbles[seat], playerNames)}</span>
              )}
            </li>
          );
        })}
      </ul>
      {watchers.length > 0 && <div className="presence-watching">{`Watching: ${watchers.map(({ name }) => name).join(', ')}`}</div>}
      {waitingFor !== null && (
        <div className="presence-waiting">{`Waiting for ${playerNames[waitingFor]} to reconnect`}</div>
      )}
    </div>
  );
}
