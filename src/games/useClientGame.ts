import { useEffect, useState } from 'react';
import type { ClientGame } from '../clientGames.ts';
import { loadClientGame, loadedClientGame } from './loadClientGame.ts';

export type ClientGameStatus = 'idle' | 'loading' | 'ready' | 'error';

// Downloads a game's client (null: none wanted) and re-renders when it arrives or fails
export function useClientGame(id: string | null): { status: ClientGameStatus; client: ClientGame | null } {
  const [failed, setFailed] = useState<string | null>(null);
  const [, setArrived] = useState(0);
  const client = id === null ? null : loadedClientGame(id) ?? null;
  useEffect(() => {
    if (id === null || loadedClientGame(id)) return;
    let live = true;
    loadClientGame(id).then(
      () => { if (live) setArrived(n => n + 1); },
      () => { if (live) setFailed(id); }
    );
    return () => { live = false; };
  }, [id]);
  const status = id === null ? 'idle' : client ? 'ready' : failed === id ? 'error' : 'loading';
  return { status, client };
}
