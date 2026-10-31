import { useState } from 'react';
import { downloadPauseFile, fetchPauseFile } from '../services/pauseFiles.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { BasePublicState, Seat } from '../../shared/types.ts';

type PausedScreenProps = {
  game: GameInfo;
  gameState: BasePublicState;
  seats: { seat: Seat; name: string }[]; // the seats this device holds, empty for a spectator or table screen
  onResume: () => void;
};

// Takes the place of the table while paused: each held seat downloads its file, and a player resumes once all are back
export default function PausedScreen({ game, gameState, seats, onResume }: PausedScreenProps) {
  const [failed, setFailed] = useState<Seat | null>(null);
  const waiting = gameState.disconnected.map(seat => gameState.playerNames[seat]);

  async function download(seat: Seat) {
    setFailed(null);
    const file = await fetchPauseFile(game.id, gameState.gameId, seat);
    if (file) downloadPauseFile(file);
    else setFailed(seat);
  }

  return (
    <div className="paused-screen">
      <h2>Game paused</h2>
      {seats.length > 0 && (
        <p>Keep your pause file. If the server loses this game, everyone's files together bring it back.</p>
      )}
      {seats.map(({ seat, name }) => (
        <div key={seat} className="paused-screen-download">
          <button type="button" className="primary-button" onClick={() => download(seat)}>
            {seats.length === 1 ? 'Download my pause file' : `Download ${name}'s pause file`}
          </button>
          {failed === seat && <span className="paused-screen-error" role="alert">Could not download the pause file</span>}
        </div>
      ))}
      <p className="paused-screen-waiting">{waiting.length > 0 ? `Waiting for ${waiting.join(', ')}` : 'Everyone is here'}</p>
      {waiting.length === 0 && seats.length > 0 && (
        <button type="button" className="primary-button" onClick={onResume}>Resume</button>
      )}
    </div>
  );
}
