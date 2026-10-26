import { formatTurnClock, useCountdown } from '../hooks/useCountdown.ts';
import useTurnTimer from '../sound/useTurnTimer.ts';
import ReactionPicker from './ReactionPicker';
import { keepOnScreen } from './keepOnScreen.ts';
import { reactionLabel } from './reactions.ts';
import useReactions from './useReactions.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type PresenceBarProps = {
  gameState: BasePublicState;
  playerNumber: Seat | null; // null for a spectator
  spectatorId: string | null;
  canReact: boolean; // false while a shared device hands over, since nobody is playing on it
  onDismiss: ((seat: Seat) => void) | null; // null for a spectator, who cannot start a vote
};

// Lists every player (tap another's name to react; held seats get a way to start a dismiss vote), the turn timer
// beside the current player, and who is watching
export default function PresenceBar({ gameState, playerNumber, spectatorId, canReact, onDismiss }: PresenceBarProps) {
  const { disconnected, activePlayers, playerNames, currentPlayer, isGameOver, started, undoVote, dismissVote } = gameState;
  const watchers = gameState.spectators ?? [];
  const myName = playerNumber !== null
    ? playerNames[playerNumber]
    : watchers.find(spectator => spectator.id === spectatorId)?.name;
  const { bubbles, cooldownUntil } = useReactions(playerNumber, myName, playerNumber === null);
  // cooldownUntil is on this device's clock, so no server offset (a stale one inflated the countdown)
  const cooldownMs = useCountdown(cooldownUntil, undefined) ?? 0;
  const { msLeft, paused } = useTurnTimer(gameState, playerNumber);
  const timed = msLeft !== null && currentPlayer !== null && !isGameOver;
  if (activePlayers.length < 2 && disconnected.length === 0 && watchers.length === 0 && !timed) return null;

  const voteOpen = undoVote !== null || dismissVote !== null;
  const waitingFor = !isGameOver && currentPlayer !== null && disconnected.includes(currentPlayer) ? currentPlayer : null;

  return (
    <div className="presence-bar">
      <ul className="presence-list">
        {activePlayers.map(seat => {
          const held = disconnected.includes(seat);
          const name = held ? <span>{`${playerNames[seat]} (disconnected)`}</span>
            : seat === playerNumber || !canReact ? <span>{playerNames[seat]}</span>
            : <ReactionPicker target={seat} name={playerNames[seat]} disabled={!started || isGameOver} cooldownMs={cooldownMs} />;
          return (
            <li key={seat} className="presence-player" data-disconnected={held ? '' : undefined}>
              {timed && seat === currentPlayer ? (
                <span className="presence-timer" data-low={msLeft > 0 && msLeft <= 10_000 ? '' : undefined} data-over={msLeft <= 0 ? '' : undefined}>
                  {name}
                  <span className="presence-clock">{formatTurnClock(msLeft) + (paused ? ' (paused)' : '')}</span>
                </span>
              ) : name}
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
      {timed && msLeft <= 0 && (currentPlayer === playerNumber
        ? <div className="presence-overtime" role="status">Time's up</div>
        : <div className="presence-overtime">{`${playerNames[currentPlayer]} is over time`}</div>)}
      {watchers.length > 0 && <div className="presence-watching">{`Watching: ${watchers.map(({ name }) => name).join(', ')}`}</div>}
      {waitingFor !== null && (
        <div className="presence-waiting">{`Waiting for ${playerNames[waitingFor]} to reconnect`}</div>
      )}
    </div>
  );
}
