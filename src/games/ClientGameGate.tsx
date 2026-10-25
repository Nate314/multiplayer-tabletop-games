import { useEffect, useState, type ReactNode } from 'react';
import type { ClientGame } from '../clientGames.ts';
import { useClientGame, type ClientGameStatus } from './useClientGame.ts';

// A fast download shows nothing at all, rather than a flash of "Loading"
const LOADING_DELAY_MS = 200;

// The browser remembers a failed import() of a file and never fetches it again, and a deploy may have replaced the
// file, so only a fresh page (which also gets the newest index.html) can load the game
const reload = () => window.location.reload();

type ClientGameNoticeProps = { status: ClientGameStatus; name: string; onRetry?: () => void };

// "Loading <game>..." on a slow download, or "Could not load <game>" with Retry
export function ClientGameNotice({ status, name, onRetry = reload }: ClientGameNoticeProps) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setSlow(true), LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status]);
  if (status === 'error') {
    return (
      <div className="lobby-error client-game-error" role="alert">
        <span>{`Could not load ${name}`}</span>
        <button type="button" className="lobby-button" onClick={onRetry}>Retry</button>
      </div>
    );
  }
  if (status === 'loading' && slow) return <p className="client-game-loading" role="status">{`Loading ${name}...`}</p>;
  return null;
}

type ClientGameGateProps = { id: string; name: string; children: (client: ClientGame) => ReactNode };

// Shows its children once the game's client has downloaded, and the notice until then
export default function ClientGameGate({ id, name, children }: ClientGameGateProps) {
  const { status, client } = useClientGame(id);
  return client ? children(client) : <ClientGameNotice status={status} name={name} />;
}
