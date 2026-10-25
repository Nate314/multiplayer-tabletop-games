import { CLIENT_LOADERS, type ClientGame } from '../clientGames.ts';

const loading = new Map<string, Promise<ClientGame>>();
const loaded = new Map<string, ClientGame>();

// One download per game, shared by every caller; a failed one is forgotten so the next call tries again
export function loadClientGame(id: string, loaders: Record<string, () => Promise<ClientGame>> = CLIENT_LOADERS): Promise<ClientGame> {
  let promise = loading.get(id);
  if (!promise) {
    const loader = loaders[id];
    promise = loader ? loader() : Promise.reject(new Error(`Unknown game "${id}"`));
    loading.set(id, promise);
    promise.then(client => loaded.set(id, client), () => loading.delete(id));
  }
  return promise;
}

// A game already downloaded, so a screen can show it on its first render instead of a frame later
export const loadedClientGame = (id: string): ClientGame | undefined => loaded.get(id);
