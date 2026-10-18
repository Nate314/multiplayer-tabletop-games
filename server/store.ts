import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { BaseGameState } from '../shared/types.ts';

// What a started game needs to come back after a restart; see `Room` in games.ts for `history` and `timeline`
export type SavedRoom = { gameType: string; state: BaseGameState; history: BaseGameState[]; timeline: BaseGameState[] };

// Keyed by room ID, `<gameType>/<gameId>`
export type GameStore = {
  loadAll(): Map<string, SavedRoom>;
  save(roomId: string, room: SavedRoom): void;
  remove(roomId: string): void;
};

// `file` is ':memory:' or a path; a path's folder is created when missing
export function openGameStore(file: string): GameStore {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, game_type TEXT NOT NULL, data TEXT NOT NULL)');

  const selectAll = db.prepare('SELECT id, game_type, data FROM rooms');
  const upsert = db.prepare(
    'INSERT INTO rooms (id, game_type, data) VALUES (?, ?, ?) ' +
    'ON CONFLICT (id) DO UPDATE SET game_type = excluded.game_type, data = excluded.data'
  );
  const deleteOne = db.prepare('DELETE FROM rooms WHERE id = ?');

  return {
    // A row whose data does not parse, or lacks a state object and history and timeline arrays,
    // is logged and deleted, so it never blocks a start
    loadAll() {
      const rooms = new Map<string, SavedRoom>();
      for (const row of selectAll.all()) {
        const id = String(row.id);
        try {
          const { state, history, timeline } = JSON.parse(String(row.data)) ?? {};
          if (typeof state !== 'object' || state === null || !Array.isArray(history) || !Array.isArray(timeline)) {
            throw new Error('Saved game has the wrong shape');
          }
          rooms.set(id, { gameType: String(row.game_type), state, history, timeline });
        } catch (error) {
          console.error(`Dropping saved game ${id}:`, error);
          deleteOne.run(id);
        }
      }
      return rooms;
    },

    save(roomId, { gameType, state, history, timeline }) {
      upsert.run(roomId, gameType, JSON.stringify({ state, history, timeline }));
    },

    remove(roomId) {
      deleteOne.run(roomId);
    }
  };
}
