import { useCountdown } from '../hooks/useCountdown.ts';
import ReactionPicker from './ReactionPicker';
import { keepOnScreen } from './keepOnScreen.ts';
import { reactionLabel } from './reactions.ts';
import useReactions from './useReactions.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type PresenceBarProps = {
  gameState: BasePublicState;
  playerNumber: Seat;
  onDismiss: (seat: Seat) => void;
};

// Lists every player: tap another's name to react, and held seats get a way to start a dismiss vote
export default function PresenceBar({ gameState, playerNumber, onDismiss }: PresenceBarProps) {
  const { disconnected, activePlayers, playerNames, currentPlayer, isGameOver, started, undoVote, dismissVote, serverTime } = gameState;
  const { bubbles, cooldownUntil } = useReactions(playerNumber, gameState);
  const cooldownMs = useCountdown(cooldownUntil, serverTime) ?? 0;
  if (activePlayers.length < 2 && disconnected.length === 0) return null;

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
              {held && !isGameOver && (
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
      {waitingFor !== null && (
        <div className="presence-waiting">{`Waiting for ${playerNames[waitingFor]} to reconnect`}</div>
      )}
    </div>
  );
}
