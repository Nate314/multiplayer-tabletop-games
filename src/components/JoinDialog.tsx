import { useEffect } from 'react';
import RulesButton from './RulesButton';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { ClientGameNotice } from '../games/ClientGameGate.tsx';
import { useClientGame } from '../games/useClientGame.ts';
import { saveJoinForm } from '../services/settings.ts';
import { joinLink } from '../services/share.ts';
import type { JoinRole } from '../../shared/types.ts';

// Plan 8 appends the other roles
const JOIN_ROLES: { role: JoinRole; label: string; button: string }[] = [
  { role: 'player', label: 'Player', button: 'Join' },
  { role: 'spectator', label: 'Spectator', button: 'Watch' },
  { role: 'tableScreen', label: 'Table screen', button: 'Show table' },
];

type JoinDialogProps = {
  game: GameInfo;
  playerName: string;
  gameId: string;
  role: JoinRole;
  error: string | null;
  onPlayerNameChange: (playerName: string) => void;
  onGameIdChange: (gameId: string) => void;
  onRoleChange: (role: JoinRole) => void;
  onJoin: (role?: JoinRole) => void;
  onCancel: () => void;
};

export default function JoinDialog({
  game,
  playerName,
  gameId,
  role,
  error,
  onPlayerNameChange,
  onGameIdChange,
  onRoleChange,
  onJoin,
  onCancel,
}: JoinDialogProps) {
  // Starts the game's download now, so it is usually ready by the time the player joins
  const { status, client } = useClientGame(game.id);
  // The fresh page a retry needs keeps the form, and opens this dialog again through its join link once there is a game ID
  const retry = () => {
    saveJoinForm({ playerName, gameId, role });
    window.location.assign(gameId.trim() ? joinLink('', game.id, gameId.trim()) : '/');
  };
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="lobby-overlay">
      <form
        className="lobby-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-dialog-title"
        onSubmit={(e) => {
          e.preventDefault();
          onJoin();
        }}
      >
        <h2 id="join-dialog-title">{`Join ${game.name}`}</h2>
        <div className="join-role-switch" role="group" aria-label="Join as">
          {JOIN_ROLES.map(option => (
            <button key={option.role} type="button" aria-pressed={role === option.role} onClick={() => onRoleChange(option.role)}>
              {option.label}
            </button>
          ))}
        </div>
        {error && <div className="lobby-error">{error}</div>}
        {role === 'player' && (error === 'Game is full' || error === 'Game already in progress') && (
          <button
            type="button"
            className="lobby-button"
            onClick={() => {
              onRoleChange('spectator');
              onJoin('spectator');
            }}
          >
            Watch instead
          </button>
        )}
        {role !== 'tableScreen' && (
          <label className="lobby-field">
            Your name
            <input
              type="text"
              value={playerName}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </label>
        )}
        <label className="lobby-field">
          Game ID
          <input
            type="text"
            value={gameId}
            onChange={(e) => onGameIdChange(e.target.value)}
            maxLength={20}
            placeholder="Pick one to create or join a game"
          />
        </label>
        <ClientGameNotice status={status} name={game.name} onRetry={retry} />
        <div className="lobby-dialog-actions">
          {client && <RulesButton game={game} faq={client.faq} />}
          <button type="button" className="lobby-button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="lobby-button lobby-button-primary">{JOIN_ROLES.find(option => option.role === role)?.button}</button>
        </div>
      </form>
    </div>
  );
}
