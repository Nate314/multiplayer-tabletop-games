import type { createGameManager } from './games.ts';

type Manager = ReturnType<typeof createGameManager>;

// Remembers each seat's key as a browser does, so a test can rejoin by name alone.
// A manager made after a restart takes the same `keys`, since the saved game keeps them
export function rememberingKeys(manager: Manager, keys = new Map<string, string>()): Manager {
  return {
    ...manager,
    join(gameType, gameId, playerName, rejoin, seatKey) {
      const seat = `${String(gameType)}/${String(gameId).trim()}/${String(playerName).trim().toLowerCase()}`;
      const result = manager.join(gameType, gameId, playerName, rejoin, seatKey ?? keys.get(seat));
      if ('seatKey' in result) keys.set(seat, result.seatKey);
      return result;
    }
  };
}

// Every seated player agrees to the current house rules
export function agreeAll(manager: Manager, roomId: string): void {
  const state = manager.rawState(roomId);
  if (!state) throw new Error(`no game ${roomId}`);
  const revision = state.houseRules?.revision ?? 0;
  for (const seat of state.activePlayers) {
    const result = manager.agreeHouseRules(roomId, seat, revision);
    if ('error' in result) throw new Error(result.error);
  }
}
