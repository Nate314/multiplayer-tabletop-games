import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Seat } from '../shared/types.ts';
import { createVapidKeys, type VapidKeys } from './vapid.ts';

export type PushStore = {
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
  add(roomId: string, seat: Seat, endpoint: string): void;
  endpoints(roomId: string, seat: Seat): string[];
  removeSeat(roomId: string, seat: Seat): void;
  removeRoom(roomId: string): void;
  removeEndpoint(endpoint: string): void;
  roomIds(): string[];
  // Moves the subscriptions of an old game id to a new one; a room whose new id already has subscriptions stays
  renameGameType(from: string, to: string): number;
  close(): void;
};

// `file` is ':memory:' or a path; a path's folder is created when missing
export function openPushStore(file: string): PushStore {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  db.exec(
    'CREATE TABLE IF NOT EXISTS push_subscriptions (room_id TEXT, seat INTEGER, endpoint TEXT, ' +
    'PRIMARY KEY (room_id, seat, endpoint))'
  );
  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  // REPLACE gives a resubscribe a new rowid, so it counts as the newest
  const add = db.prepare('INSERT OR REPLACE INTO push_subscriptions (room_id, seat, endpoint) VALUES (?, ?, ?)');
  // Each push costs a signature and a request, so one seat cannot pile up endpoints
  const trim = db.prepare(
    'DELETE FROM push_subscriptions WHERE room_id = ?1 AND seat = ?2 AND rowid NOT IN ' +
    '(SELECT rowid FROM push_subscriptions WHERE room_id = ?1 AND seat = ?2 ORDER BY rowid DESC LIMIT 3)'
  );
  const endpoints = db.prepare('SELECT endpoint FROM push_subscriptions WHERE room_id = ? AND seat = ?');
  const removeSeat = db.prepare('DELETE FROM push_subscriptions WHERE room_id = ? AND seat = ?');
  const removeRoom = db.prepare('DELETE FROM push_subscriptions WHERE room_id = ?');
  const removeEndpoint = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
  const roomIds = db.prepare('SELECT DISTINCT room_id FROM push_subscriptions');
  const prefixRooms = db.prepare(
    "SELECT DISTINCT room_id FROM push_subscriptions WHERE substr(room_id, 1, length(?1) + 1) = ?1 || '/'"
  );
  const roomTaken = db.prepare('SELECT 1 FROM push_subscriptions WHERE room_id = ?');
  const renameRoom = db.prepare('UPDATE OR IGNORE push_subscriptions SET room_id = ?2 WHERE room_id = ?1');
  return {
    getSetting: (key) => (getSetting.get(key) as { value: string } | undefined)?.value ?? null,
    setSetting: (key, value) => void setSetting.run(key, value),
    add: (roomId, seat, endpoint) => {
      add.run(roomId, seat, endpoint);
      trim.run(roomId, seat);
    },
    endpoints: (roomId, seat) => (endpoints.all(roomId, seat) as { endpoint: string }[]).map((row) => row.endpoint),
    removeSeat: (roomId, seat) => void removeSeat.run(roomId, seat),
    removeRoom: (roomId) => void removeRoom.run(roomId),
    removeEndpoint: (endpoint) => void removeEndpoint.run(endpoint),
    roomIds: () => (roomIds.all() as { room_id: string }[]).map((row) => row.room_id),
    renameGameType: (from, to) => {
      let renamed = 0;
      for (const { room_id } of prefixRooms.all(from) as { room_id: string }[]) {
        const next = to + room_id.slice(from.length);
        if (!roomTaken.get(next)) renamed += Number(renameRoom.run(room_id, next).changes);
      }
      return renamed;
    },
    close: () => db.close()
  };
}

export function loadVapidKeys(store: PushStore): VapidKeys {
  const saved = store.getSetting('vapid');
  if (saved) return JSON.parse(saved) as VapidKeys;
  const keys = createVapidKeys();
  store.setSetting('vapid', JSON.stringify(keys));
  return keys;
}
