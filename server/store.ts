import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { BaseGameState } from '../shared/types.ts';

// What a started game needs to come back after a restart; see `Room` in games.ts for `history` and `timeline`
export type SavedRoom = { gameType: string; state: BaseGameState; history: BaseGameState[]; timeline: BaseGameState[] };

// How a save changes the saved steps. Step `index` is `history[index]` (the state before move index + 1)
// and `timeline[index]` (the state right after it); a move pushes one step and an approved undo pops the last
export type StepChange =
  | { type: 'push'; index: number; before: BaseGameState; after: BaseGameState }
  | { type: 'pop'; index: number };

// A finished game kept for history, export and rematch; `id` is `<gameType>/<gameId>#<n>` and outlives its room
export type ArchivedGame = {
  id: string; gameType: string; gameId: string; n: number; finishedAt: number;
  state: BaseGameState; history: BaseGameState[]; timeline: BaseGameState[];
};

// Keyed by room ID, `<gameType>/<gameId>`. A save writes the live state and at most one step,
// so its cost does not grow with the length of the game
export type GameStore = {
  loadAll(): Map<string, SavedRoom>;
  save(roomId: string, gameType: string, state: BaseGameState, step?: StepChange): void;
  remove(roomId: string): void;
  archive(game: ArchivedGame): void;
  loadArchive(id: string): ArchivedGame | undefined;
  nextGameNumber(gameType: string, gameId: string): number;
  pruneArchive(before: number): number;
};

function isObject(value: unknown): value is BaseGameState {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// `file` is ':memory:' or a path; a path's folder is created when missing
export function openGameStore(file: string): GameStore {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, game_type TEXT NOT NULL, data TEXT NOT NULL)');
  db.exec(
    'CREATE TABLE IF NOT EXISTS room_steps (room_id TEXT NOT NULL, idx INTEGER NOT NULL, ' +
    'before TEXT NOT NULL, after TEXT NOT NULL, PRIMARY KEY (room_id, idx))'
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS archived_games (id TEXT PRIMARY KEY, game_type TEXT NOT NULL, ' +
    'game_id TEXT NOT NULL, n INTEGER NOT NULL, finished_at INTEGER NOT NULL, data TEXT NOT NULL)'
  );
  db.exec('CREATE INDEX IF NOT EXISTS archived_games_game ON archived_games (game_type, game_id)');

  const selectAll =db.prepare('SELECT id, game_type, data FROM rooms');
  const selectSteps = db.prepare('SELECT idx, before, after FROM room_steps WHERE room_id = ? ORDER BY idx');
  const upsert = db.prepare(
    'INSERT INTO rooms (id, game_type, data) VALUES (?, ?, ?) ' +
    'ON CONFLICT (id) DO UPDATE SET game_type = excluded.game_type, data = excluded.data'
  );
  // Replaces a step left behind by a pop that failed, so a later move at the same index still saves
  const insertStep = db.prepare('INSERT OR REPLACE INTO room_steps (room_id, idx, before, after) VALUES (?, ?, ?, ?)');
  const deleteStepsFrom = db.prepare('DELETE FROM room_steps WHERE room_id = ? AND idx >= ?');
  const deleteRoom = db.prepare('DELETE FROM rooms WHERE id = ?');
  const deleteSteps = db.prepare('DELETE FROM room_steps WHERE room_id = ?');
  const deleteOrphanSteps = db.prepare('DELETE FROM room_steps WHERE room_id NOT IN (SELECT id FROM rooms)');

  const insertArchive = db.prepare(
    'INSERT OR REPLACE INTO archived_games (id, game_type, game_id, n, finished_at, data) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const selectArchive = db.prepare('SELECT game_type, game_id, n, finished_at, data FROM archived_games WHERE id = ?');
  const selectMaxN = db.prepare('SELECT MAX(n) AS n FROM archived_games WHERE game_type = ? AND game_id = ?');
  const deleteArchivedBefore = db.prepare('DELETE FROM archived_games WHERE finished_at < ?');

  function transaction(write: () => void): void {
    db.exec('BEGIN');
    try {
      write();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function remove(roomId: string): void {
    transaction(() => {
      deleteRoom.run(roomId);
      deleteSteps.run(roomId);
    });
  }

  // A room whose data does not parse, is not a state object, or whose steps do not run 0, 1, 2, ... in order
  // is thrown out
  function loadRoom(roomId: string, gameType: string, data: string): SavedRoom {
    const state: unknown = JSON.parse(data);
    if (!isObject(state)) throw new Error('Saved game has the wrong shape');
    const history: BaseGameState[] = [];
    const timeline: BaseGameState[] = [];
    for (const row of selectSteps.all(roomId)) {
      const before: unknown = JSON.parse(String(row.before));
      const after: unknown = JSON.parse(String(row.after));
      if (Number(row.idx) !== history.length || !isObject(before) || !isObject(after)) {
        throw new Error('Saved game has the wrong shape');
      }
      history.push(before);
      timeline.push(after);
    }
    return { gameType, state, history, timeline };
  }

  return {
    // A room that does not load is logged and deleted with its steps, so it never blocks a start
    loadAll() {
      deleteOrphanSteps.run();
      const rooms = new Map<string, SavedRoom>();
      for (const row of selectAll.all()) {
        const id = String(row.id);
        try {
          rooms.set(id, loadRoom(id, String(row.game_type), String(row.data)));
        } catch (error) {
          console.error(`Dropping saved game ${id}:`, error);
          remove(id);
        }
      }
      return rooms;
    },

    save(roomId, gameType, state, step) {
      transaction(() => {
        upsert.run(roomId, gameType, JSON.stringify(state));
        if (step?.type === 'push') {
          insertStep.run(roomId, step.index, JSON.stringify(step.before), JSON.stringify(step.after));
        } else if (step?.type === 'pop') {
          deleteStepsFrom.run(roomId, step.index);
        }
      });
    },

    remove,

    archive(game) {
      const { id, gameType, gameId, n, finishedAt, state, history, timeline } = game;
      insertArchive.run(id, gameType, gameId, n, finishedAt, JSON.stringify({ state, history, timeline }));
    },

    // An archive that does not load is logged and left in place; the 90 day prune clears it
    loadArchive(id) {
      const row = selectArchive.get(id);
      if (!row) return undefined;
      try {
        const { state, history, timeline }: Record<string, unknown> = JSON.parse(String(row.data));
        const isSteps = (value: unknown): value is BaseGameState[] => Array.isArray(value) && value.every(isObject);
        if (!isObject(state) || !isSteps(history) || !isSteps(timeline)) throw new Error('Archived game has the wrong shape');
        return {
          id, gameType: String(row.game_type), gameId: String(row.game_id),
          n: Number(row.n), finishedAt: Number(row.finished_at), state, history, timeline
        };
      } catch (error) {
        console.error(`Unreadable archived game ${id}:`, error);
        return undefined;
      }
    },

    nextGameNumber(gameType, gameId) {
      return Number(selectMaxN.get(gameType, gameId)?.n ?? 0) + 1;
    },

    pruneArchive(before) {
      return Number(deleteArchivedBefore.run(before).changes);
    }
  };
}
