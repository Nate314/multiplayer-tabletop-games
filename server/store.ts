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
  archive(game: ArchivedGame, imageIds?: string[]): void; // `imageIds` are the uploaded images the game shows
  loadArchive(id: string): ArchivedGame | undefined;
  nextGameNumber(gameType: string, gameId: string): number;
  // Also deletes the images whose room is gone and that no remaining archive shows
  pruneArchive(before: number): number;
  // Never replaces an image stored under `id`; one whose room is gone (kept for an archive) joins `roomId`
  saveImage(id: string, roomId: string, mime: ImageMime, bytes: Buffer): void;
  loadImage(id: string): { mime: string; bytes: Buffer } | undefined;
  countRoomImages(roomId: string): number;
  // Deletes the room's images, except those an archived game shows: they stay until pruneArchive drops that archive
  deleteRoomImages(roomId: string): void;
};

export type ImageMime = 'image/jpeg' | 'image/png';

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
  // `room_id` is null once the room is gone and only an archive still shows the image
  db.exec('CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, room_id TEXT, mime TEXT NOT NULL, bytes BLOB NOT NULL)');
  db.exec('CREATE INDEX IF NOT EXISTS images_room ON images (room_id)');
  db.exec(
    'CREATE TABLE IF NOT EXISTS archive_images (archive_id TEXT NOT NULL, image_id TEXT NOT NULL, PRIMARY KEY (archive_id, image_id))'
  );
  db.exec('CREATE INDEX IF NOT EXISTS archive_images_image ON archive_images (image_id)');

  const selectAll = db.prepare('SELECT id, game_type, data FROM rooms');
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

  const deleteArchiveImages = db.prepare('DELETE FROM archive_images WHERE archive_id = ?');
  const insertArchiveImage = db.prepare('INSERT OR IGNORE INTO archive_images (archive_id, image_id) VALUES (?, ?)');
  const deleteOrphanArchiveImages = db.prepare('DELETE FROM archive_images WHERE archive_id NOT IN (SELECT id FROM archived_games)');
  const insertImage = db.prepare(
    'INSERT INTO images (id, room_id, mime, bytes) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT (id) DO UPDATE SET room_id = excluded.room_id WHERE images.room_id IS NULL'
  );
  const selectImage = db.prepare('SELECT mime, bytes FROM images WHERE id = ?');
  const countRoomImages = db.prepare('SELECT COUNT(*) AS count FROM images WHERE room_id = ?');
  const UNARCHIVED = 'id NOT IN (SELECT image_id FROM archive_images)';
  const deleteRoomImages = db.prepare(`DELETE FROM images WHERE room_id = ? AND ${UNARCHIVED}`);
  const detachRoomImages = db.prepare('UPDATE images SET room_id = NULL WHERE room_id = ?');
  const deleteDetachedImages = db.prepare(`DELETE FROM images WHERE room_id IS NULL AND ${UNARCHIVED}`);
  // A lobby is never saved, so on load the images of any room not in `rooms` belong to a room that is gone
  const deleteUnsavedImages = db.prepare(`DELETE FROM images WHERE room_id NOT IN (SELECT id FROM rooms) AND ${UNARCHIVED}`);
  const detachUnsavedImages = db.prepare('UPDATE images SET room_id = NULL WHERE room_id NOT IN (SELECT id FROM rooms)');

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
      transaction(() => {
        deleteUnsavedImages.run();
        detachUnsavedImages.run();
      });
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

    archive(game, imageIds = []) {
      const { id, gameType, gameId, n, finishedAt, state, history, timeline } = game;
      transaction(() => {
        insertArchive.run(id, gameType, gameId, n, finishedAt, JSON.stringify({ state, history, timeline }));
        deleteArchiveImages.run(id);
        for (const imageId of imageIds) insertArchiveImage.run(id, imageId);
      });
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
      let pruned = 0;
      transaction(() => {
        pruned = Number(deleteArchivedBefore.run(before).changes);
        deleteOrphanArchiveImages.run();
        deleteDetachedImages.run();
      });
      return pruned;
    },

    saveImage(id, roomId, mime, bytes) {
      insertImage.run(id, roomId, mime, bytes);
    },

    loadImage(id) {
      const row = selectImage.get(id);
      return row && { mime: String(row.mime), bytes: Buffer.from(row.bytes as Uint8Array) };
    },

    countRoomImages(roomId) {
      return Number(countRoomImages.get(roomId)?.count ?? 0);
    },

    deleteRoomImages(roomId) {
      transaction(() => {
        deleteRoomImages.run(roomId);
        detachRoomImages.run(roomId);
      });
    }
  };
}
