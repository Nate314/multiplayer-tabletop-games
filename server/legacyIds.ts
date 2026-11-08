import { LEGACY_IDS, type LegacyIds } from '../games/legacyIds.ts';
import type { StatsStore } from './stats/store.ts';
import type { PushStore } from './pushStore.ts';
import type { GameStore } from './store.ts';

// Stats always follow a rename; saved rooms, archives and push subscriptions only when the old saves still fit the new game
export function renameLegacyGames(
  stats: Pick<StatsStore, 'renameGameType'>,
  games: Pick<GameStore, 'renameGameType'>,
  push: Pick<PushStore, 'renameGameType'>,
  legacy: LegacyIds = LEGACY_IDS
): void {
  for (const [old, { id, keepsSaves }] of Object.entries(legacy)) {
    const results = stats.renameGameType(old, id);
    const rooms = keepsSaves ? games.renameGameType(old, id) : 0;
    const alerts = keepsSaves ? push.renameGameType(old, id) : 0;
    if (results > 0 || rooms > 0 || alerts > 0) {
      console.log(`Renamed game ${old} to ${id}: ${results} results, ${rooms} saved games, ${alerts} subscriptions`);
    }
  }
}
