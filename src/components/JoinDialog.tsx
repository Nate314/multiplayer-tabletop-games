import { useEffect } from 'react';
import FaqButton from './FaqButton';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { FaqItem } from '../clientGames.ts';

type JoinDialogProps = {
  game: GameInfo;
  faq: FaqItem[];
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
  faq,
  playerName,
  gameId,
  error,
  onPlayerNameChange,
  onGameIdChange,
  onJoin,
  onCancel,
}: JoinDialogProps) {
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
        <div className="lobby-dialog-actions">
          <FaqButton game={game} items={faq} />
          <button type="button" className="lobby-button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="lobby-button lobby-button-primary">Join</button>
        </div>
      </form>
    </div>
  );
}
