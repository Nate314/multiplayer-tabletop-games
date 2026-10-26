import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { GameResult } from '../../shared/types.ts';
import type { StatsGame } from '../../shared/stats.ts';

// Keyed by the SHA-256 of a device ID, never the ID itself. Devices linked by a code share one person
export type StatsStore = {
  record(result: GameResult): void;
  resultsFor(hash: string): StatsGame[] | 'cleared';
  deviceCount(hash: string): number;
  clear(hash: string): { games: number; devices: number };
  link(fromHash: string, toHash: string): { games: number } | { error: string };
  samePerson(hash: string, hashes: string[]): boolean;
};

const FORMER_PLAYER = 'Former player';

// `file` is ':memory:' or a path; a path's folder is created when missing
export function openStatsStore(file: string): StatsStore {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY AUTOINCREMENT)');
  db.exec('CREATE TABLE IF NOT EXISTS devices (hash TEXT PRIMARY KEY, person_id INTEGER NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS cleared_devices (hash TEXT PRIMARY KEY)');
  db.exec(
    'CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY AUTOINCREMENT, archive_id TEXT UNIQUE NOT NULL, ' +
    'game_type TEXT NOT NULL, game_id TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER NOT NULL, ' +
    'move_count INTEGER NOT NULL)'
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS result_players (result_id INTEGER NOT NULL, seat INTEGER NOT NULL, name TEXT NOT NULL, ' +
    'place INTEGER NOT NULL, score TEXT, person_id INTEGER, PRIMARY KEY (result_id, seat))'
  );
  db.exec('CREATE INDEX IF NOT EXISTS result_players_person ON result_players (person_id)');

  const personOf = db.prepare('SELECT person_id FROM devices WHERE hash = ?');
  const insertPerson = db.prepare('INSERT INTO people DEFAULT VALUES');
  const insertDevice = db.prepare('INSERT INTO devices (hash, person_id) VALUES (?, ?)');
  const isCleared = db.prepare('SELECT 1 FROM cleared_devices WHERE hash = ?');
  const hasResult = db.prepare('SELECT 1 FROM results WHERE archive_id = ?');
  const insertResult = db.prepare(
    'INSERT INTO results (archive_id, game_type, game_id, started_at, finished_at, move_count) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertPlayer = db.prepare(
    'INSERT INTO result_players (result_id, seat, name, place, score, person_id) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const selectResults = db.prepare(
    'SELECT id, archive_id, game_type, game_id, started_at, finished_at, move_count FROM results ' +
    'WHERE id IN (SELECT result_id FROM result_players WHERE person_id = ?) ORDER BY finished_at DESC, id DESC'
  );
  const selectPlayers = db.prepare(
    'SELECT name, place, score, person_id FROM result_players WHERE result_id = ? ORDER BY seat'
  );
  const countDevices = db.prepare('SELECT COUNT(*) AS n FROM devices WHERE person_id = ?');
  const countGames = db.prepare('SELECT COUNT(DISTINCT result_id) AS n FROM result_players WHERE person_id = ?');
  const formerSeats = db.prepare('UPDATE result_players SET name = ?, person_id = NULL WHERE person_id = ?');
  const deleteEmptyPlayers = db.prepare(
    'DELETE FROM result_players WHERE result_id NOT IN (SELECT result_id FROM result_players WHERE person_id IS NOT NULL)'
  );
  const deleteEmptyResults = db.prepare(
    'DELETE FROM results WHERE id NOT IN (SELECT result_id FROM result_players)'
  );
  const clearDevices = db.prepare('INSERT OR IGNORE INTO cleared_devices (hash) SELECT hash FROM devices WHERE person_id = ?');
  const deleteDevices = db.prepare('DELETE FROM devices WHERE person_id = ?');
  const deletePerson = db.prepare('DELETE FROM people WHERE id = ?');
  const moveSeats = db.prepare('UPDATE result_players SET person_id = ? WHERE person_id = ?');
  const moveDevices = db.prepare('UPDATE devices SET person_id = ? WHERE person_id = ?');

  function transaction<T>(write: () => T): T {
    db.exec('BEGIN');
    try {
      const value = write();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function findPerson(hash: string): number | undefined {
    const row = personOf.get(hash);
    return row ? Number(row.person_id) : undefined;
  }

  function ensurePerson(hash: string): number {
    const existing = findPerson(hash);
    if (existing !== undefined) return existing;
    const id = Number(insertPerson.run().lastInsertRowid);
    insertDevice.run(hash, id);
    return id;
  }

  return {
    record(result) {
      if (result.abandoned || result.moveCount === 0) return;
      transaction(() => {
        if (hasResult.get(result.archiveId)) return;
        // A cleared device stays a Former player; a seat with no device has no person
        const seats = result.players.map(player => {
          const hash = player.deviceId;
          const known = hash !== undefined && !isCleared.get(hash);
          return { player, person: known ? ensurePerson(hash) : null };
        });
        if (seats.every(seat => seat.person === null)) return;
        const id = Number(insertResult.run(
          result.archiveId, result.gameType, result.gameId, result.startedAt, result.finishedAt, result.moveCount
        ).lastInsertRowid);
        for (const { player, person } of seats) {
          const standing = result.standings.find(s => s.seat === player.seat);
          const name = player.deviceId !== undefined && person === null ? FORMER_PLAYER : player.name;
          insertPlayer.run(id, player.seat, name, standing?.place ?? result.standings.length + 1, standing?.score ?? null, person);
        }
      });
    },

    resultsFor(hash) {
      if (isCleared.get(hash)) return 'cleared';
      const person = findPerson(hash);
      if (person === undefined) return [];
      return selectResults.all(person).map(row => ({
        archiveId: String(row.archive_id), gameType: String(row.game_type), gameId: String(row.game_id),
        startedAt: Number(row.started_at), finishedAt: Number(row.finished_at), moveCount: Number(row.move_count),
        historyAvailable: false,
        players: selectPlayers.all(Number(row.id)).map(p => ({
          name: String(p.name), place: Number(p.place),
          ...(p.score === null ? {} : { score: String(p.score) }),
          you: Number(p.person_id) === person
        }))
      }));
    },

    deviceCount(hash) {
      const person = findPerson(hash);
      return person === undefined ? 0 : Number(countDevices.get(person)?.n);
    },

    clear(hash) {
      return transaction(() => {
        const person = findPerson(hash);
        if (person === undefined) {
          db.prepare('INSERT OR IGNORE INTO cleared_devices (hash) VALUES (?)').run(hash);
          return { games: 0, devices: 0 };
        }
        const counts = { games: Number(countGames.get(person)?.n), devices: Number(countDevices.get(person)?.n) };
        formerSeats.run(FORMER_PLAYER, person);
        deleteEmptyPlayers.run();
        deleteEmptyResults.run();
        clearDevices.run(person);
        deleteDevices.run(person);
        deletePerson.run(person);
        return counts;
      });
    },

    link(fromHash, toHash) {
      return transaction(() => {
        const from = ensurePerson(fromHash);
        const to = ensurePerson(toHash);
        if (from === to) return { error: 'This device is already linked' };
        const games = Number(countGames.get(from)?.n);
        moveSeats.run(to, from);
        moveDevices.run(to, from);
        deletePerson.run(from);
        return { games };
      });
    },

    samePerson(hash, hashes) {
      const person = findPerson(hash);
      return hashes.some(other => other === hash || (person !== undefined && findPerson(other) === person));
    }
  };
}
