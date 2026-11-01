import { useEffect, useState } from 'react';
import ServerSvg from '../assets/ServerSvg';
import { svgUrl } from '../assets/svgCache.ts';
import useEscapeKey from '../hooks/useEscapeKey';
import { fetchResumeStatus, RESUME_POLL_MS, sessionForResume } from '../services/pauseFiles.ts';
import type { Session } from '../services/session.ts';
import { joinLink } from '../services/share.ts';
import type { GameInfo } from '../../shared/gameDefinition.ts';
import type { ResumeStatus, ResumeUpload } from '../../shared/pauseFile.ts';

type ResumeWaitingRoomProps = {
  game: GameInfo;
  uploads: ResumeUpload[]; // this device's files that went in, each with its new seat key
  onReady: (session: Session) => void;
  onCancel: () => void;
};

const NO_LONGER_WAITING = 'This game is no longer waiting. Upload your file again';

// Who has uploaded so far, until the server has every file and the game is back; never shows any file's contents
export default function ResumeWaitingRoom({ game, uploads, onReady, onCancel }: ResumeWaitingRoomProps) {
  useEscapeKey(onCancel);
  // The last upload's answer is the newest status there is
  const [status, setStatus] = useState<ResumeStatus>(uploads[uploads.length - 1]);
  const [lost, setLost] = useState(false);
  const { ready } = status;
  const { gameType, gameId, seatKey } = uploads[0];

  useEffect(() => {
    if (ready) {
      onReady(sessionForResume(uploads));
      return undefined;
    }
    let live = true;
    const timer = setInterval(async () => {
      const next = await fetchResumeStatus(gameType, gameId, seatKey);
      if (!live) return;
      setLost(next === null);
      if (next) setStatus(next);
    }, RESUME_POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [ready, uploads, onReady, gameType, gameId, seatKey]);

  return (
    <div className="overlay">
      <div className="modal resume-waiting" role="dialog" aria-labelledby="resume-waiting-title">
        <h2 id="resume-waiting-title">{`Resuming ${game.name} ${gameId}`}</h2>
        <ul className="resume-waiting-players">
          {status.players.map(({ seat, name, ready: fileIn }) => (
            <li key={seat}>{`${name}: ${fileIn ? 'file in' : 'waiting'}`}</li>
          ))}
        </ul>
        {status.error && <div className="lobby-error" role="alert">{status.error}</div>}
        {lost && <div className="lobby-error" role="alert">{NO_LONGER_WAITING}</div>}
        <ServerSvg
          url={svgUrl('qr', joinLink(window.location.origin, game.id, gameId))}
          className="resume-waiting-qr"
          title={`QR code to join ${game.name} ${gameId}`}
        />
        <p>Everyone else chooses Resume a game and uploads their own file</p>
        <div className="modal-buttons">
          <button type="button" className="primary-button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
