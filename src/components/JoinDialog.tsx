import { useEffect } from 'react';
import RulesButton from './RulesButton';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import { ClientGameNotice } from '../games/ClientGameGate.tsx';
import { useClientGame } from '../games/useClientGame.ts';
import { saveJoinForm } from '../services/settings.ts';
import { joinLink } from '../services/share.ts';

type JoinDialogProps = {
  game: GameInfo;
  playerName: string;
  gameId: string;
  error: string | null;
  onPlayerNameChange: (playerName: string) => void;
  onGameIdChange: (gameId: string) => void;
  onJoin: () => void;
  onCancel: () => void;
};

export default function JoinDialog({
  game,
  playerName,
  gameId,
  error,
  onPlayerNameChange,
  onGameIdChange,
  onJoin,
  onCancel,
}: JoinDialogProps) {
  // Starts the game's download now, so it is usually ready by the time the player joins
  const { status, client } = useClientGame(game.id);
  // The fresh page a retry needs keeps the form, and opens this dialog again through its join link once there is a game ID
  const retry = () => {
    saveJoinForm({ playerName, gameId });
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
        {error && <div className="lobby-error">{error}</div>}
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
          <button type="submit" className="lobby-button lobby-button-primary">Join</button>
        </div>
      </form>
    </div>
  );
}
